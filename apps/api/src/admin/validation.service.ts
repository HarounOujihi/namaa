import { Injectable, BadRequestException } from '@nestjs/common';
import Ajv, { ValidateFunction } from 'ajv';
import { PrismaService } from '../prisma/prisma.service';

export interface ValidationIssue {
  path: string;
  message: string;
}

const ajv = new Ajv({ allErrors: true, strict: false });

/**
 * Content validation pipeline (spec: plans/exercise_type_spec.md):
 * 1. JSON-schema check of `configuration` against the exercise type version's configSchema
 * 2. Per-type semantic checks (answer membership, counts, uniqueness, concatenation)
 * 3. Referential checks (referenced assets exist)
 * `exerciseTypeCode` drives the semantic pass; schema errors are labeled with instance paths.
 */
@Injectable()
export class ValidationService {
  constructor(private readonly prisma: PrismaService) {}

  async validate(args: {
    exerciseTypeCode: string;
    configSchema: object;
    configuration: unknown;
  }): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    const validateFn = ajv.compile(args.configSchema);
    if (!validateFn(args.configuration)) {
      for (const err of validateFn.errors ?? []) {
        issues.push({
          path: err.instancePath || '/',
          message: `${err.message ?? 'invalid value'}${err.params ? ` (${JSON.stringify(err.params)})` : ''}`,
        });
      }
    }

    issues.push(...this.semanticChecks(args.exerciseTypeCode, args.configuration));
    issues.push(...(await this.referentialChecks(args.configuration)));
    return issues;
  }

  assertValid(args: {
    exerciseTypeCode: string;
    configSchema: object;
    configuration: unknown;
  }): void {
    // Synchronous subset (schema + semantics) for guarded writes; referential
    // checks are async and run separately where a DB roundtrip is acceptable.
    const issues: ValidationIssue[] = [];
    const validateFn = ajv.compile(args.configSchema);
    if (!validateFn(args.configuration)) {
      for (const err of validateFn.errors ?? []) {
        issues.push({
          path: err.instancePath || '/',
          message: err.message ?? 'invalid value',
        });
      }
    }
    issues.push(...this.semanticChecks(args.exerciseTypeCode, args.configuration));
    if (issues.length > 0) {
      throw new BadRequestException({
        message: 'Exercise configuration is invalid',
        validationErrors: issues,
      });
    }
  }

  private semanticChecks(code: string, config: unknown): ValidationIssue[] {
    if (typeof config !== 'object' || config === null) {
      return [];
    }
    const c = config as Record<string, unknown>;
    const issues: ValidationIssue[] = [];
    const push = (path: string, message: string) => issues.push({ path, message });

    const opts = (c.options ?? c.items ?? c.cards ?? c.pieces) as
      | { id?: string; text?: string }[]
      | undefined;
    const ids = opts?.map((o) => o.id) ?? [];

    switch (code) {
      case 'MULTIPLE_CHOICE':
      case 'IMAGE_MATCH': {
        if (!promptHasContent(c.prompt)) push('/prompt', 'prompt must have text, imageAssetId, or audioAssetId');
        if (ids.length < 2 || ids.length > 6) push('/options', 'options must contain 2-6 entries');
        if (new Set(ids).size !== ids.length) push('/options', 'option ids must be unique');
        if (typeof c.correctOptionId === 'string' && !ids.includes(c.correctOptionId)) {
          push('/correctOptionId', 'must reference one of the option ids');
        }
        break;
      }
      case 'AUDIO_MATCH': {
        if (c.mode === 'pair_comparison') {
          if (!wordHasContent(c.wordA)) push('/wordA', 'wordA must have text or audioAssetId');
          if (!wordHasContent(c.wordB)) push('/wordB', 'wordB must have text or audioAssetId');
        } else if (c.mode === 'sound_to_image') {
          if (!wordHasContent(c.target)) push('/target', 'target must have text or audioAssetId');
          if (ids.length < 2 || ids.length > 6) push('/options', 'options must contain 2-6 entries');
          if (new Set(ids).size !== ids.length) push('/options', 'option ids must be unique');
          if (typeof c.correctOptionId === 'string' && !ids.includes(c.correctOptionId)) {
            push('/correctOptionId', 'must reference one of the option ids');
          }
        }
        break;
      }
      case 'SOUND_POSITION': {
        const phoneme = typeof c.targetPhoneme === 'string' ? c.targetPhoneme : '';
        if (phoneme.length < 1 || phoneme.length > 2) {
          push('/targetPhoneme', 'must be 1-2 characters');
        }
        if (!wordHasContent(c.word)) push('/word', 'word must have text or audioAssetId');
        break;
      }
      case 'ORDERING': {
        if (ids.length < 2 || ids.length > 8) push('/items', 'items must contain 2-8 entries');
        if (new Set(ids).size !== ids.length) push('/items', 'item ids must be unique');
        for (const item of (c.items as { id?: string; text?: string }[] | undefined) ?? []) {
          if (!item.text && !itemHasAsset(item)) push('/items', `item ${item.id} must have text or an asset`);
        }
        break;
      }
      case 'WORD_BUILDER': {
        const pieces = (c.pieces as { id?: string; text?: string }[] | undefined) ?? [];
        const distractors = (c.distractors as { id?: string; text?: string }[] | undefined) ?? [];
        const joined = pieces.map((p) => p.text ?? '').join('');
        if (typeof c.targetWord === 'string' && joined !== c.targetWord) {
          push('/pieces', `pieces concatenate to "${joined}" but targetWord is "${c.targetWord}"`);
        }
        const allIds = [...pieces, ...distractors].map((p) => p.id);
        if (new Set(allIds).size !== allIds.length) push('/pieces', 'piece and distractor ids must be unique');
        break;
      }
      case 'MEMORY_GAME': {
        if (ids.length < 3 || ids.length > 8) push('/cards', 'cards must contain 3-8 entries');
        for (const card of (c.cards as { id?: string; text?: string }[] | undefined) ?? []) {
          if (!card.text && !itemHasAsset(card)) push('/cards', `card ${card.id} must have text or an asset`);
        }
        break;
      }
      default:
        break;
    }
    return issues;
  }

  /** Every key ending in `AssetId` (at any depth) must point at an existing asset row. */
  private async referentialChecks(config: unknown): Promise<ValidationIssue[]> {
    const assetIds = new Set<string>();
    collectAssetIds(config, assetIds);
    if (assetIds.size === 0) {
      return [];
    }
    const existing = await this.prisma.asset.findMany({
      where: { id: { in: [...assetIds] } },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((a) => a.id));
    return [...assetIds]
      .filter((id) => !existingIds.has(id))
      .map((id) => ({ path: '/', message: `Referenced asset does not exist: ${id}` }));
  }
}

function collectAssetIds(value: unknown, out: Set<string>): void {
  if (Array.isArray(value)) {
    for (const v of value) collectAssetIds(v, out);
    return;
  }
  if (typeof value !== 'object' || value === null) {
    return;
  }
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    if (/AssetId$/.test(key) && typeof v === 'string' && v.length > 0) {
      out.add(v);
    } else {
      collectAssetIds(v, out);
    }
  }
}

function promptHasContent(prompt: unknown): boolean {
  if (typeof prompt !== 'object' || prompt === null) return false;
  const p = prompt as Record<string, unknown>;
  return Boolean(p.text || p.imageAssetId || p.audioAssetId);
}

function wordHasContent(word: unknown): boolean {
  if (typeof word !== 'object' || word === null) return false;
  const w = word as Record<string, unknown>;
  return Boolean(w.text || w.audioAssetId);
}

function itemHasAsset(item: unknown): boolean {
  if (typeof item !== 'object' || item === null) return false;
  const i = item as Record<string, unknown>;
  return Boolean(i.imageAssetId || i.audioAssetId);
}
