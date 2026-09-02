import {
  Injectable,
  InternalServerErrorException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AssetType } from '@prisma/client';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { PrismaService } from '../prisma/prisma.service';

const PRESIGNED_URL_TTL_SEC = 7 * 24 * 60 * 60;

@Injectable()
export class AssetsService implements OnModuleInit {
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.bucket = this.config.getOrThrow<string>('S3_BUCKET');
    this.s3 = new S3Client({
      region: this.config.get<string>('S3_REGION') ?? 'us-east-1',
      endpoint: this.config.get<string>('S3_ENDPOINT'),
      forcePathStyle: true,
      credentials: {
        accessKeyId: this.config.getOrThrow<string>('S3_ACCESS_KEY'),
        secretAccessKey: this.config.getOrThrow<string>('S3_SECRET_KEY'),
      },
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await this.s3.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }
  }

  async upload(file: {
    buffer: Buffer;
    mimetype: string;
    size: number;
    originalname: string;
  }, type: AssetType) {
    const ext = extname(file.originalname).toLowerCase().slice(0, 10);
    const storageKey = `assets/${randomUUID()}${ext}`;
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );
    return this.prisma.asset.create({
      data: {
        type,
        storageKey,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        status: 'PUBLISHED',
      },
    });
  }

  async urlForAssetId(assetId: string): Promise<string | null> {
    const asset = await this.prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) {
      return null;
    }
    return this.presignedGetUrl(asset.storageKey);
  }

  async presignedGetUrl(storageKey: string): Promise<string> {
    try {
      return await getSignedUrl(
        this.s3,
        new GetObjectCommand({ Bucket: this.bucket, Key: storageKey }),
        { expiresIn: PRESIGNED_URL_TTL_SEC },
      );
    } catch (err) {
      throw new InternalServerErrorException(
        `Failed to sign asset URL: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
