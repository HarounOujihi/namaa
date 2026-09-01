import { Module } from '@nestjs/common';
import { AssetsModule } from '../assets/assets.module';
import { SoundsModule } from '../sounds/sounds.module';
import { PlayController } from './play.controller';
import { PlayService } from './play.service';

@Module({
  imports: [AssetsModule, SoundsModule],
  controllers: [PlayController],
  providers: [PlayService],
})
export class PlayModule {}
