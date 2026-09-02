import { Module } from '@nestjs/common';
import { ChildAccessModule } from '../child-access/child-access.module';
import { ParentService } from './parent.service';
import { ParentController } from './parent.controller';

@Module({
  imports: [ChildAccessModule],
  providers: [ParentService],
  controllers: [ParentController],
})
export class ParentModule {}
