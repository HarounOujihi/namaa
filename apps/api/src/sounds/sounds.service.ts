import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AssetsService } from '../assets/assets.service';
import { KNOWN_APP_SOUND_KEYS } from './app-sound-keys';

@Injectable()
export class SoundsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: AssetsService,
  ) {}

  /** Seed any missing canonical slots (idempotent). */
  async onModuleInit(): Promise<void> {
    for (const def of KNOWN_APP_SOUND_KEYS) {
      await this.prisma.appSound.upsert({
        where: { key: def.key },
        update: {},
        create: {
          key: def.key,
          label: def.label,
          textFallback: def.defaultText,
        },
      });
    }
  }

  async listForAdmin() {
    const rows = await this.prisma.appSound.findMany({
      orderBy: { key: 'asc' },
      include: { asset: true },
    });
    return Promise.all(
      rows.map(async (row) => ({
        key: row.key,
        label: row.label,
        textFallback: row.textFallback,
        updatedAt: row.updatedAt,
        asset: row.asset
          ? {
              id: row.asset.id,
              mimeType: row.asset.mimeType,
              sizeBytes: row.asset.sizeBytes,
              url: await this.assets.presignedGetUrl(row.asset.storageKey),
            }
          : null,
      })),
    );
  }

  async update(
    key: string,
    dto: { assetId?: string | null; textFallback?: string; label?: string },
  ) {
    const def = KNOWN_APP_SOUND_KEYS.find((k) => k.key === key);
    const existing = await this.prisma.appSound.findUnique({ where: { key } });
    if (!def && !existing) {
      throw new NotFoundException(`Unknown platform sound key: ${key}`);
    }
    if (dto.assetId) {
      const asset = await this.prisma.asset.findUnique({ where: { id: dto.assetId } });
      if (!asset || !asset.mimeType.startsWith('audio/')) {
        throw new NotFoundException('assetId must reference an AUDIO asset');
      }
    }
    return this.prisma.appSound.upsert({
      where: { key },
      update: {
        ...(dto.assetId !== undefined && { assetId: dto.assetId }),
        ...(dto.textFallback !== undefined && { textFallback: dto.textFallback }),
        ...(dto.label !== undefined && { label: dto.label }),
      },
      create: {
        key,
        label: dto.label ?? def?.label ?? key,
        textFallback: dto.textFallback ?? def?.defaultText ?? '',
        assetId: dto.assetId ?? null,
      },
    });
  }

  /** Child-app shape: key → playable URL (null = use TTS) + fallback text. */
  async soundsForApp(): Promise<Record<string, { url: string | null; text: string }>> {
    const rows = await this.prisma.appSound.findMany({ include: { asset: true } });
    const out: Record<string, { url: string | null; text: string }> = {};
    for (const def of KNOWN_APP_SOUND_KEYS) {
      out[def.key] = { url: null, text: def.defaultText };
    }
    for (const row of rows) {
      out[row.key] = {
        url: row.asset
          ? await this.assets.presignedGetUrl(row.asset.storageKey)
          : null,
        text: row.textFallback,
      };
    }
    return out;
  }
}
