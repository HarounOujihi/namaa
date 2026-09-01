import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExerciseTypeDto, UpdateExerciseTypeDto, CreateTypeVersionDto } from './dto/exercise-type.dto';

const VERSION_SELECT = {
  id: true,
  version: true,
  createdAt: true,
} as const;

const VERSION_SELECT_WITH_SCHEMA = {
  id: true,
  version: true,
  createdAt: true,
  configSchema: true,
} as const;

@Injectable()
export class ExerciseTypesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(includeSchemas: boolean) {
    const types = await this.prisma.exerciseType.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          select: includeSchemas
            ? VERSION_SELECT_WITH_SCHEMA
            : VERSION_SELECT,
        },
      },
    });
    return types.map((t) => ({
      id: t.id,
      code: t.code,
      name: t.name,
      description: t.description,
      versionsCount: t.versions.length,
      latestVersion: t.versions[0] ?? null,
    }));
  }

  async get(id: string) {
    const type = await this.prisma.exerciseType.findUnique({
      where: { id },
      include: { versions: { orderBy: { version: 'desc' } } },
    });
    if (!type) {
      throw new NotFoundException('Exercise type not found');
    }
    return type;
  }

  async create(dto: CreateExerciseTypeDto) {
    assertDraft07ish(dto.configSchema);
    const existing = await this.prisma.exerciseType.findUnique({ where: { code: dto.code } });
    if (existing) {
      throw new ConflictException(`Exercise type code already exists: ${dto.code}`);
    }
    return this.prisma.exerciseType.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        versions: { create: { version: 1, configSchema: dto.configSchema } },
      },
      include: { versions: { orderBy: { version: 'desc' } } },
    });
  }

  async update(id: string, dto: UpdateExerciseTypeDto) {
    await this.get(id);
    return this.prisma.exerciseType.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
      include: { versions: { orderBy: { version: 'desc' } } },
    });
  }

  async createVersion(id: string, dto: CreateTypeVersionDto) {
    const type = await this.get(id);
    assertDraft07ish(dto.configSchema);
    const latest = type.versions[0];
    const version = await this.prisma.exerciseTypeVersion.create({
      data: {
        exerciseTypeId: id,
        version: (latest?.version ?? 0) + 1,
        configSchema: dto.configSchema,
      },
    });
    return { ...type, versions: [version, ...type.versions] };
  }
}

/** Reject schemas that are not plain objects with a `type` root — catches pasted examples/garbage. */
function assertDraft07ish(schema: object): void {
  const s = schema as Record<string, unknown>;
  if (typeof s.type !== 'string' || s.type !== 'object') {
    throw new BadRequestException(
      'configSchema must be a JSON Schema with root "type": "object"',
    );
  }
  if (typeof s.properties !== 'object' || s.properties === null) {
    throw new BadRequestException('configSchema must define "properties"');
  }
}
