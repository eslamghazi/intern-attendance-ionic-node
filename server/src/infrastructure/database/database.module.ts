import { Global, Module } from '@nestjs/common';
import { UnitOfWorkService } from './unit-of-work.service.js';
import { BootstrapService } from './bootstrap.service.js';
import { MigrationService } from './migration.service.js';
import { SuperadminSeedService } from './superadmin-seed.service.js';
import { AdvisoryLockService } from './advisory-lock.service.js';
import { PG_POOL, PoolLifecycle, poolProvider } from './pool.provider.js';

/**
 * Everything that touches Postgres, in one place.
 *
 * `UnitOfWorkService` is how a query runs: it opens (or joins) the transaction
 * that repositories pick up from the async context. `AdvisoryLockService` is the
 * single exception — see its own file for why a lock cannot go through a
 * transaction — and `PG_POOL` exists so that exception has to be injected rather
 * than imported.
 */
@Global()
@Module({
  providers: [
    poolProvider,
    PoolLifecycle,
    UnitOfWorkService,
    AdvisoryLockService,
    MigrationService,
    SuperadminSeedService,
    BootstrapService,
  ],
  exports: [PG_POOL, UnitOfWorkService, AdvisoryLockService],
})
export class DatabaseModule {}
