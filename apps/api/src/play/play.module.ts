import { Module } from '@nestjs/common';
import { AssetsModule } from '../assets/assets.module';
import { ProgressionModule } from '../progression/progression.module';
import { RewardsModule } from '../rewards/rewards.module';
import { ChildAccessModule } from '../child-access/child-access.module';
import { SoundsModule } from '../sounds/sounds.module';
import { PlayController } from './play.controller';
import { PlayService } from './play.service';

@Module({
  imports: [AssetsModule, SoundsModule, ProgressionModule, RewardsModule, ChildAccessModule],
  controllers: [PlayController],
  providers: [PlayService],
  exports: [PlayService],
})
export class PlayModule {}
