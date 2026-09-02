import { Module } from '@nestjs/common';
import { AssetsModule } from '../assets/assets.module';
import { AdminModule } from '../admin/admin.module';
import { PlayModule } from '../play/play.module';
import { AssessmentService } from './assessment.service';
import { AdminAssessmentController, AssessmentPlayController } from './assessment.controllers';

@Module({
  imports: [AssetsModule, AdminModule, PlayModule],
  controllers: [AdminAssessmentController, AssessmentPlayController],
  providers: [AssessmentService],
})
export class AssessmentModule {}
