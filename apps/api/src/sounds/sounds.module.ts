import { Module } from '@nestjs/common';
import { AssetsModule } from '../assets/assets.module';
import { SoundsService } from './sounds.service';
import { AdminSoundsController } from './admin-sounds.controller';

@Module({
  imports: [AssetsModule],
  controllers: [AdminSoundsController],
  providers: [SoundsService],
  exports: [SoundsService],
})
export class SoundsModule {}
