import { Module } from '@nestjs/common';
import { SuperadminController } from './superadmin.controller.js';
import { SuperadminService } from './superadmin.service.js';
import { SuperadminRepository } from './superadmin.repository.js';

@Module({
  controllers: [SuperadminController],
  providers: [SuperadminService, SuperadminRepository],
  exports: [SuperadminService],
})
export class SuperadminModule {}
