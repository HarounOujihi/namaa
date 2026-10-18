import { Prisma, PrismaClient, type Skill } from '@prisma/client';

const prisma = new PrismaClient();

// Demo fixtures for the child app's multi-roadmap picker. Each roadmap gets a
// PUBLISHED v1 (children only see published versions) built from exercises
// that are already published, one stage per skill. Names carry "(تجريبية)" so
// they are easy to spot and delete from the CMS. Idempotent by name.
const TEST_ROADMAPS: { name: string; skillCodes: string[] }[] = [
  { name: 'رحلة الأصوات (تجريبية)', skillCodes: ['AUDITORY_PERCEPTION', 'DECODING'] },
  { name: 'رحلة الحروف والصور (تجريبية)', skillCodes: ['VISUAL_PERCEPTION', 'VOCABULARY'] },
  { name: 'رحلة القراءة (تجريبية)', skillCodes: ['DECODING', 'VOCABULARY', 'READING_COMPREHENSION'] },
];

async function seedTestRoadmap(name: string, skillCodes: string[], order: number): Promise<void> {
  if (await prisma.roadmap.findFirst({ where: { name } })) {
    console.log(`${name}: already exists — skipping`);
    return;
  }

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
  if (stages.length === 0) {
    console.log(`${name}: no published exercises for its skills — skipping`);
    return;
  }

  await prisma.$transaction(
    async (tx) => {
      const roadmap = await tx.roadmap.create({ data: { name, order, isActive: true } });
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
              create: exerciseIds.map((exerciseId, itemIndex) => ({
                exerciseId,
                order: itemIndex + 1,
                itemType: 'EXERCISE',
              })),
            },
          },
        });
        previousStageId = stage.id;
      }
    },
    { timeout: 30_000 },
  );
  const itemCount = stages.reduce((sum, stage) => sum + stage.exerciseIds.length, 0);
  console.log(`${name}: created (order ${order}, ${stages.length} stages, ${itemCount} items)`);
}

async function main(): Promise<void> {
  const { _max } = await prisma.roadmap.aggregate({ _max: { order: true } });
  let order = (_max.order ?? 0) + 1;
  for (const { name, skillCodes } of TEST_ROADMAPS) {
    await seedTestRoadmap(name, skillCodes, order++);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
