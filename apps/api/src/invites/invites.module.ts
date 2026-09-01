import { Module } from '@nestjs/common';
import { ChildrenModule } from '../children/children.module';
import { InvitesController } from './invites.controller';
import { InvitesService } from './invites.service';

@Module({
  imports: [ChildrenModule],
  controllers: [InvitesController],
  providers: [InvitesService],
})
export class InvitesModule {}
