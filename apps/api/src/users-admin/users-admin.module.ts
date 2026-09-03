import { Module } from '@nestjs/common';
import { UsersAdminService } from './users-admin.service';
import { UsersAdminController } from './users-admin.controller';

@Module({
  providers: [UsersAdminService],
  controllers: [UsersAdminController],
})
export class UsersAdminModule {}
