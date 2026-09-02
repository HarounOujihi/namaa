import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AssetType } from '@prisma/client';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { AssetsService } from './assets.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

@ApiTags('assets')
@ApiBearerAuth()
@Controller('assets')
@UseGuards(JwtAuthGuard)
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Post()
  @HttpCode(201)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_UPLOAD_BYTES },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    // Validated manually: multipart bodies bypass the global ValidationPipe DTO path.
    @Body('type') type?: string,
  ) {
    if (!file) {
      throw new BadRequestException('file is required');
    }
    if (!Object.values(AssetType).includes(type as AssetType)) {
      throw new BadRequestException(
        `type must be one of: ${Object.values(AssetType).join(', ')}`,
      );
    }
    if (!file.mimetype.startsWith('image/') && !file.mimetype.startsWith('audio/')) {
      throw new BadRequestException('Only image and audio uploads are accepted');
    }

    const asset = await this.assets.upload(file, type as AssetType);
    return {
      id: asset.id,
      type: asset.type,
      mimeType: asset.mimeType,
      originalName: asset.originalName,
      url: await this.assets.urlForAssetId(asset.id),
    };
  }

  @Get(':id/url')
  async url(@Param('id') id: string) {
    const url = await this.assets.urlForAssetId(id);
    if (!url) {
      throw new BadRequestException('Unknown asset');
    }
    return { url };
  }
}
