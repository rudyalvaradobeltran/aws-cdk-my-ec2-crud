import { Module } from '@nestjs/common';
import { UserController } from './application/controllers/user.controller';
//import { ActivityService } from './domain/services/user.service';
//import { ActivityRepository } from './infrastructure/repositories/user.repository';

@Module({
  imports: [],
  controllers: [UserController],
  providers: [] /*[ActivityService, ActivityRepository],*/
})
export class AppModule {}
