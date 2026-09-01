import * as bcrypt from 'bcryptjs';
import { Prisma, PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

import {
  AGE_GROUPS,
  DIFFICULTY_LEVELS,
  EXERCISE_TYPES,
  SAMPLE_EXERCISES,
  STAGE_ASSIGNMENTS,
} from './seed-content';

// The 9 canonical skills from the client brief (content bank levels 1-9).
// Arabic is canonical; English is dashboard-display only.
const SKILLS: { code: string; ar: string; en: string }[] = [
  { code: 'AUDITORY_PERCEPTION', ar: 'تنمية الإدراك السمعي', en: 'Auditory Perception' },
  { code: 'VISUAL_PERCEPTION', ar: 'الإدراك البصري', en: 'Visual Perception' },
  { code: 'SIMILAR_LETTERS_DISCRIMINATION', ar: 'التمييز بين الحروف المتشابهة', en: 'Similar Letter Discrimination' },
  { code: 'DECODING', ar: 'فك الرموز القرائية', en: 'Reading Decoding' },
  { code: 'PHONOLOGICAL_AWARENESS', ar: 'الوعي الصوتي', en: 'Phonological Awareness' },
  { code: 'VOCABULARY', ar: 'تكوين المفردات', en: 'Vocabulary Building' },
  { code: 'SPELLING', ar: 'التهجئة', en: 'Spelling' },
  { code: 'READING_FLUENCY', ar: 'الاسترسال القرائي', en: 'Reading Fluency' },
  { code: 'READING_COMPREHENSION', ar: 'الفهم القرائي', en: 'Reading Comprehension' },
];

async function seedSuperAdmin() {
  const email = process.env.SUPER_ADMIN_EMAIL ?? 'admin@dyslexia.local';
  const password = process.env.SUPER_ADMIN_PASSWORD ?? 'ChangeMe!123';
  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role: UserRole.SUPER_ADMIN,
    },
  });
  console.log(`Super admin ready: ${email}`);
}

async function seedSkills() {
  for (const [index, skill] of SKILLS.entries()) {
    await prisma.skill.upsert({
      where: { code: skill.code },
      update: { name: skill.ar, nameTranslations: { ar: skill.ar, en: skill.en } },
      create: {
        code: skill.code,
        name: skill.ar,
        nameTranslations: { ar: skill.ar, en: skill.en },
        order: index + 1,
      },
    });
  }
  console.log(`Seeded ${SKILLS.length} skills`);
}

async function seedDefaultRoadmap() {
  const existing = await prisma.roadmap.findFirst({
    where: { isDefault: true },
    include: { versions: true },
  });
  if (existing?.versions.some((v) => v.status === 'PUBLISHED')) {
    console.log('Default roadmap already published — skipping');
    return;
  }

  const skills = await prisma.skill.findMany({ orderBy: { order: 'asc' } });
  const roadmap =
    existing ??
    (await prisma.roadmap.create({
      data: { name: 'الرحلة العلاجية', isDefault: true },
    }));
  const version = await prisma.roadmapVersion.create({
    data: {
      roadmapId: roadmap.id,
      version: (existing?.versions.length ?? 0) + 1,
      status: 'PUBLISHED',
      publishedAt: new Date(),
    },
  });

  // One stage per skill, sequential chain (the brief's level 1 → 9 journey).
  // Mastery values are seed defaults — each stage's rule is per-row config,
  // editable later via the CMS without code changes.
  let previousStageId: string | null = null;
  for (const [index, skill] of skills.entries()) {
    const stage: { id: string } = await prisma.roadmapStage.create({
      data: {
        roadmapVersionId: version.id,
        name: skill.name,
        nameTranslations: skill.nameTranslations as Prisma.InputJsonValue,
        order: index + 1,
        masteryThreshold: 0.8,
        minAccuracy: 0.7,
        minSuccessfulAttempts: 3,
        ...(previousStageId
          ? { prerequisites: { connect: [{ id: previousStageId }] } }
          : {}),
        requiredSkills: { create: { skillId: skill.id } },
      },
    });
    previousStageId = stage.id;
  }
  console.log(
    `Seeded default roadmap v${version.version} with ${skills.length} stages`,
  );
}

async function seedContent() {
  for (const level of DIFFICULTY_LEVELS) {
    await prisma.difficultyLevel.upsert({ where: { code: level.code }, update: level, create: level });
  }
  for (const group of AGE_GROUPS) {
    await prisma.ageGroup.upsert({ where: { code: group.code }, update: group, create: group });
  }
  console.log(`Seeded ${DIFFICULTY_LEVELS.length} difficulty levels, ${AGE_GROUPS.length} age groups`);

  for (const type of EXERCISE_TYPES) {
    const existing = await prisma.exerciseType.findUnique({ where: { code: type.code } });
    if (!existing) {
      await prisma.exerciseType.create({
        data: {
          code: type.code,
          name: type.name,
          description: type.description,
          versions: { create: { version: 1, configSchema: type.configSchema as Prisma.InputJsonValue } },
        },
      });
    }
  }
  console.log(`Seeded ${EXERCISE_TYPES.length} exercise types (v1 schemas)`);

  let created = 0;
  for (const sample of SAMPLE_EXERCISES) {
    const dup = await prisma.exerciseVersion.findFirst({ where: { title: sample.title } });
    if (dup) continue;
    const [skill, difficulty, ageGroup, type] = await Promise.all([
      prisma.skill.findUnique({ where: { code: sample.skillCode } }),
      prisma.difficultyLevel.findUnique({ where: { code: sample.difficultyCode } }),
      prisma.ageGroup.findUnique({ where: { code: sample.ageGroupCode } }),
      prisma.exerciseType.findUnique({ where: { code: sample.typeCode } }),
    ]);
    if (!skill || !difficulty || !ageGroup || !type) {
      throw new Error(`Seed prerequisites missing for sample "${sample.title}"`);
    }
    const typeVersion = await prisma.exerciseTypeVersion.findFirst({
      where: { exerciseTypeId: type.id },
      orderBy: { version: 'desc' },
    });
    await prisma.exercise.create({
      data: {
        versions: {
          create: {
            version: 1,
            title: sample.title,
            instructions: sample.instructions,
            skillId: skill.id,
            difficultyLevelId: difficulty.id,
            ageGroupId: ageGroup.id,
            exerciseTypeVersionId: typeVersion!.id,
            configuration: sample.configuration as Prisma.InputJsonValue,
            status: 'PUBLISHED',
            publishedAt: new Date(),
          },
        },
      },
    });
    created++;
  }
  console.log(`Sample exercises: ${created} created, ${SAMPLE_EXERCISES.length - created} already present`);

  for (const assignment of STAGE_ASSIGNMENTS) {
    const stage = await prisma.roadmapStage.findFirst({
      where: { requiredSkills: { some: { skill: { code: assignment.stageSkillCode } } } },
      include: { stageItems: true },
    });
    if (!stage || stage.stageItems.length > 0) continue;
    let order = 1;
    for (const title of assignment.exerciseTitles) {
      const version = await prisma.exerciseVersion.findFirst({
        where: { title },
        orderBy: { version: 'desc' },
      });
      if (!version) continue;
      await prisma.stageItem.create({
        data: { roadmapStageId: stage.id, exerciseId: version.exerciseId, order: order++, itemType: 'EXERCISE' },
      });
    }
  }
  console.log('Stage assignments applied');
}

async function main() {
  await seedSuperAdmin();
  await seedSkills();
  await seedDefaultRoadmap();
  await seedContent();
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
