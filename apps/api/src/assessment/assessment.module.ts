import { Module } from '@nestjs/common';
import { AssetsModule } from '../assets/assets.module';
import { AdminModule } from '../admin/admin.module';
import { ChildAccessModule } from '../child-access/child-access.module';
import { AssessmentService } from './assessment.service';
import { AdminAssessmentController, AssessmentPlayController } from './assessment.controllers';

@Module({
  imports: [AssetsModule, AdminModule, ChildAccessModule],
  controllers: [AdminAssessmentController, AssessmentPlayController],
  providers: [AssessmentService],
})
export class AssessmentModule {}
