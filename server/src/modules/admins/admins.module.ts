import { Module } from '@nestjs/common';
import { AdminsController } from './admins.controller.js';
import { AdminsService } from './admins.service.js';
import { AdminsRepository } from './admins.repository.js';

@Module({
  controllers: [AdminsController],
  providers: [AdminsService, AdminsRepository],
})
export class AdminsModule {}
