import { Module } from '@nestjs/common';
import { ChildAccessModule } from '../child-access/child-access.module';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';

@Module({
  imports: [ChildAccessModule],
  providers: [AnalyticsService],
  controllers: [AnalyticsController],
})
export class AnalyticsModule {}
