import { Module } from '@nestjs/common';
import { AssetsModule } from '../assets/assets.module';
import { PlayController } from './play.controller';
import { PlayService } from './play.service';

@Module({
  imports: [AssetsModule],
  controllers: [PlayController],
  providers: [PlayService],
})
export class PlayModule {}
