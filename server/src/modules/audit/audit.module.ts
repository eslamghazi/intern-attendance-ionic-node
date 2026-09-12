import { Global, Module } from '@nestjs/common';
import { AuditController } from './audit.controller.js';
import { AuditService } from './audit.service.js';
import { AuditRepository } from './audit.repository.js';

/**
 * Global, because almost every module has something worth recording and the
 * alternative is importing AuditModule into a dozen others — which is how the
 * two duplicate writers appeared in the first place.
 */
@Global()
@Module({
  controllers: [AuditController],
  providers: [AuditService, AuditRepository],
  exports: [AuditService, AuditRepository],
})
export class AuditModule {}
