import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service.js';
import { StorageModule } from '../../modules/storage/storage.module.js';

/**
 * AuditModule is global, so only StorageModule has to be imported here.
 */
@Module({
  imports: [StorageModule],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
