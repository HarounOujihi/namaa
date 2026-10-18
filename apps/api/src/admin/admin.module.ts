import { Module } from '@nestjs/common';
import { AssetsModule } from '../assets/assets.module';
import { ValidationService } from './validation.service';
import { ExerciseTypesService } from './exercise-types.service';
import { ExerciseTypesController } from './exercise-types.controller';
import { ExercisesService } from './exercises.service';
import { ExercisesController } from './exercises.controller';
import { RoadmapsService } from './roadmaps.service';
import { RoadmapsController } from './roadmaps.controller';
import { RoadmapCategoriesService } from './roadmap-categories.service';
import { RoadmapCategoriesController } from './roadmap-categories.controller';
import { AdminMetaController } from './admin-meta.controller';
import { AdminAssetsController } from './admin-assets.controller';

@Module({
  imports: [AssetsModule],
  controllers: [
    AdminMetaController,
    AdminAssetsController,
    ExerciseTypesController,
    ExercisesController,
    RoadmapsController,
    RoadmapCategoriesController,
  ],
  providers: [ValidationService, ExerciseTypesService, ExercisesService, RoadmapsService, RoadmapCategoriesService],
  exports: [ValidationService],
})
export class AdminModule {}
