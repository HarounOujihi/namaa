import { Module } from '@nestjs/common';
import { ChildAccessModule } from '../child-access/child-access.module';
import { SpecialistService } from './specialist.service';
import { SpecialistController, ChildCareController } from './specialist.controllers';

@Module({
  imports: [ChildAccessModule],
  providers: [SpecialistService],
  controllers: [SpecialistController, ChildCareController],
})
export class SpecialistModule {}
