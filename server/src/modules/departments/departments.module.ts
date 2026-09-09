import { Module } from '@nestjs/common';
import { DepartmentsController, MemberDepartmentsController } from './departments.controller.js';
import { DepartmentsService } from './departments.service.js';
import { DepartmentsRepository } from './departments.repository.js';

@Module({
  controllers: [DepartmentsController, MemberDepartmentsController],
  providers: [DepartmentsService, DepartmentsRepository],
  exports: [DepartmentsService, DepartmentsRepository],
})
export class DepartmentsModule {}

