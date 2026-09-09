import { Global, Module } from '@nestjs/common';
import { UnitOfWorkService } from './unit-of-work.service.js';

@Global()
@Module({
  providers: [UnitOfWorkService],
  exports: [UnitOfWorkService],
})
export class DatabaseModule {}
