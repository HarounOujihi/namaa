import { randomUUID } from 'crypto';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Prisma, PrismaClient, type Skill } from '@prisma/client';

// Demo content for the child app's library: categories with covers, and
// roadmaps with descriptions, covers and categories. Extra demo roadmaps are
// PUBLISHED v1s built from already-published exercises, one stage per skill.
//
// Idempotent and non-destructive: rows are matched by name, covers by their
// demo filename, and existing description/cover/category values are never
// overwritten — only missing ones are filled in. Safe to re-run after admins
// edit the content.
//
// Needs the API's DATABASE_URL and S3_* variables (see apps/api/.env).

const prisma = new PrismaClient();
const COVER_DIR = join(__dirname, 'demo-library');

const s3 = new S3Client({
  region: process.env.S3_REGION ?? 'us-east-1',
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: requiredEnv('S3_ACCESS_KEY'),
    secretAccessKey: requiredEnv('S3_SECRET_KEY'),
  },
});
const bucket = requiredEnv('S3_BUCKET');

interface CategorySpec {
  name: string;
  description: string;
  cover: string;
  order: number;
}

interface RoadmapSpec {
  name: string;
  /** Earlier fixture names this roadmap is renamed from (keeps its progress). */
  formerNames?: string[];
  description: string;
  cover: string;
  category: string;
  /** Present for demo roadmaps this script creates; absent for seeded ones. */
  skillCodes?: string[];
}

const CATEGORIES: CategorySpec[] = [
  { name: 'البرنامج العلاجي', description: 'الرحلة الأساسية خطوة بخطوة: من الاستماع إلى فهم القراءة', cover: 'category-program', order: 1 },
  { name: 'الأصوات والاستماع', description: 'ألعاب تدرّب الأذن على تمييز الأصوات وتذكّرها', cover: 'category-listening', order: 2 },
  { name: 'الحروف والصور', description: 'ألعاب تقوّي العين لتمييز الحروف ومطابقتها بالصور', cover: 'category-letters', order: 3 },
  { name: 'القراءة والفهم', description: 'من تركيب الكلمات إلى فهم القصص القصيرة', cover: 'category-reading', order: 4 },
];

const ROADMAPS: RoadmapSpec[] = [
  {
    name: 'الرحلة العلاجية',
    description: 'تسع محطات تأخذك من الاستماع الجيد إلى القراءة بثقة',
    cover: 'roadmap-main',
    category: 'البرنامج العلاجي',
  },
  {
    name: 'رحلة الأصوات',
    formerNames: ['رحلة الأصوات (تجريبية)'],
    description: 'استمع جيدًا وميّز الأصوات في بداية الكلمات',
    cover: 'roadmap-sounds',
    category: 'الأصوات والاستماع',
    skillCodes: ['AUDITORY_PERCEPTION', 'DECODING'],
  },
  {
    name: 'جزيرة الذاكرة السمعية',
    description: 'تذكّر ما تسمعه واربطه بالكلمات والصور',
    cover: 'roadmap-auditory-memory',
    category: 'الأصوات والاستماع',
    skillCodes: ['AUDITORY_PERCEPTION', 'VOCABULARY'],
  },
  {
    name: 'رحلة الحروف والصور',
    formerNames: ['رحلة الحروف والصور (تجريبية)'],
    description: 'طابق كل حرف بصورته واكتشف الحرف المختلف',
    cover: 'roadmap-letters',
    category: 'الحروف والصور',
    skillCodes: ['VISUAL_PERCEPTION', 'VOCABULARY'],
  },
  {
    name: 'مغامرة العين الذكية',
    description: 'عين ذكية تلاحظ الفروق وتركّب الكلمات',
    cover: 'roadmap-smart-eye',
    category: 'الحروف والصور',
    skillCodes: ['VISUAL_PERCEPTION', 'DECODING'],
  },
  {
    name: 'رحلة القراءة',
    formerNames: ['رحلة القراءة (تجريبية)'],
    description: 'ركّب الكلمات، اقرأ، ثم افهم',
    cover: 'roadmap-reading',
    category: 'القراءة والفهم',
    skillCodes: ['DECODING', 'VOCABULARY', 'READING_COMPREHENSION'],
  },
  {
    name: 'حكايات قصيرة',
    description: 'كلمات جديدة وقصص قصيرة ممتعة',
    cover: 'roadmap-stories',
    category: 'القراءة والفهم',
    skillCodes: ['VOCABULARY', 'READING_COMPREHENSION'],
  },
];

function requiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} is not set — run with the API environment (apps/api/.env)`);
  }
  return value;
}

/** Uploads `demo-library/<slug>.webp` once; later runs reuse the asset row. */
async function coverAssetId(slug: string): Promise<string> {
  const originalName = `demo-${slug}.webp`;
  const existing = await prisma.asset.findFirst({ where: { originalName, type: 'IMAGE' }, select: { id: true } });
  if (existing) {
    return existing.id;
  }
  const body = await readFile(join(COVER_DIR, `${slug}.webp`));
  const storageKey = `assets/${randomUUID()}.webp`;
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: storageKey, Body: body, ContentType: 'image/webp' }));
  const asset = await prisma.asset.create({
    data: { type: 'IMAGE', storageKey, originalName, mimeType: 'image/webp', sizeBytes: body.length, status: 'PUBLISHED' },
  });
  return asset.id;
}

async function seedCategory(spec: CategorySpec): Promise<string> {
  const existing = await prisma.roadmapCategory.findFirst({ where: { name: spec.name } });
  if (!existing) {
    const created = await prisma.roadmapCategory.create({
      data: { name: spec.name, description: spec.description, coverAssetId: await coverAssetId(spec.cover), order: spec.order },
    });
    console.log(`category ${spec.name}: created`);
    return created.id;
  }
  await prisma.roadmapCategory.update({
    where: { id: existing.id },
    data: {
      description: existing.description ?? spec.description,
      coverAssetId: existing.coverAssetId ?? (await coverAssetId(spec.cover)),
    },
  });
  console.log(`category ${spec.name}: kept (missing fields filled)`);
  return existing.id;
}

async function publishedStagesFor(skillCodes: string[]): Promise<{ skill: Skill; exerciseIds: string[] }[]> {
  const stages: { skill: Skill; exerciseIds: string[] }[] = [];
  for (const code of skillCodes) {
    const skill = await prisma.skill.findUniqueOrThrow({ where: { code } });
    const versions = await prisma.exerciseVersion.findMany({
      where: { skillId: skill.id, status: 'PUBLISHED' },
      orderBy: { title: 'asc' },
      select: { exerciseId: true },
    });
    const exerciseIds = [...new Set(versions.map((version) => version.exerciseId))];
    if (exerciseIds.length > 0) {
      stages.push({ skill, exerciseIds });
    }
  }
  return stages;
}

async function createPublishedRoadmap(
  spec: RoadmapSpec & { skillCodes: string[] },
  meta: { order: number; categoryId: string; coverAssetId: string },
): Promise<void> {
  const stages = await publishedStagesFor(spec.skillCodes);
  if (stages.length === 0) {
    console.log(`roadmap ${spec.name}: no published exercises for its skills — skipped`);
    return;
  }
  await prisma.$transaction(
    async (tx) => {
      const roadmap = await tx.roadmap.create({
        data: { name: spec.name, description: spec.description, isActive: true, ...meta },
      });
      const version = await tx.roadmapVersion.create({
        data: { roadmapId: roadmap.id, version: 1, status: 'PUBLISHED', publishedAt: new Date() },
      });
      let previousStageId: string | null = null;
      for (const [index, { skill, exerciseIds }] of stages.entries()) {
        const stage: { id: string } = await tx.roadmapStage.create({
          data: {
            roadmapVersionId: version.id,
            name: skill.name,
            nameTranslations: skill.nameTranslations ?? Prisma.JsonNull,
            order: index + 1,
            masteryThreshold: 0.8,
            minAccuracy: 0.7,
            minSuccessfulAttempts: 3,
            ...(previousStageId ? { prerequisites: { connect: [{ id: previousStageId }] } } : {}),
            requiredSkills: { create: { skillId: skill.id } },
            stageItems: {
              create: exerciseIds.map((exerciseId, itemIndex) => ({ exerciseId, order: itemIndex + 1, itemType: 'EXERCISE' })),
            },
          },
        });
        previousStageId = stage.id;
      }
    },
    { timeout: 30_000 },
  );
  const itemCount = stages.reduce((sum, stage) => sum + stage.exerciseIds.length, 0);
  console.log(`roadmap ${spec.name}: created (${stages.length} stages, ${itemCount} items)`);
}

async function seedRoadmap(spec: RoadmapSpec, categoryIds: Map<string, string>): Promise<void> {
  const categoryId = categoryIds.get(spec.category)!;
  const existing = await prisma.roadmap.findFirst({
    where: { name: { in: [spec.name, ...(spec.formerNames ?? [])] } },
    orderBy: { createdAt: 'asc' },
  });
  if (!existing) {
    if (spec.skillCodes === undefined) {
      console.log(`roadmap ${spec.name}: not found — run the main seed first`);
      return;
    }
    // New demo roadmaps go to the end of the list.
    const { _max } = await prisma.roadmap.aggregate({ _max: { order: true } });
    await createPublishedRoadmap(
      { ...spec, skillCodes: spec.skillCodes },
      { order: (_max.order ?? 0) + 1, categoryId, coverAssetId: await coverAssetId(spec.cover) },
    );
    return;
  }
  await prisma.roadmap.update({
    where: { id: existing.id },
    data: {
      name: spec.name,
      description: existing.description ?? spec.description,
      categoryId: existing.categoryId ?? categoryId,
      coverAssetId: existing.coverAssetId ?? (await coverAssetId(spec.cover)),
    },
  });
  console.log(`roadmap ${spec.name}: ${existing.name === spec.name ? 'kept' : `renamed from ${existing.name}`} (missing fields filled)`);
}

async function main(): Promise<void> {
  const categoryIds = new Map<string, string>();
  for (const spec of CATEGORIES) {
    categoryIds.set(spec.name, await seedCategory(spec));
  }
  for (const spec of ROADMAPS) {
    await seedRoadmap(spec, categoryIds);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
