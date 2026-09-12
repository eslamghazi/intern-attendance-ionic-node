import { Global, Module } from '@nestjs/common';
import { ExportService } from './export.service.js';

/** Global, like the database it reads: every module with an export route uses it. */
@Global()
@Module({
  providers: [ExportService],
  exports: [ExportService],
})
export class ExportModule {}
