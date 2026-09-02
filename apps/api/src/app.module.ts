import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ChildrenModule } from './children/children.module';
import { InvitesModule } from './invites/invites.module';
import { AssetsModule } from './assets/assets.module';
import { MetaController } from './health.controller';
import { AdminModule } from './admin/admin.module';
import { PlayModule } from './play/play.module';
import { SoundsModule } from './sounds/sounds.module';
import { AssessmentModule } from './assessment/assessment.module';
import { ProgressionModule } from './progression/progression.module';
import { RewardsModule } from './rewards/rewards.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    UsersModule,
    AuthModule,
    ChildrenModule,
    AdminModule,
    PlayModule,
    SoundsModule,
    AssessmentModule,
    ProgressionModule,
    RewardsModule,
    InvitesModule,
    AssetsModule,
  ],
  controllers: [MetaController],
})
export class AppModule {}
