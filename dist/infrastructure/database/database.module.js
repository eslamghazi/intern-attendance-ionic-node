var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
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
let DatabaseModule = class DatabaseModule {
};
DatabaseModule = __decorate([
    Global(),
    Module({
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
], DatabaseModule);
export { DatabaseModule };
//# sourceMappingURL=database.module.js.map