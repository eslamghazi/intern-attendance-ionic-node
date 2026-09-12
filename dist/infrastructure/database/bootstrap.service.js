var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Injectable } from '@nestjs/common';
import { UnitOfWorkService } from './unit-of-work.service.js';
import { appSettings } from './schema/index.js';
import { MigrationService } from './migration.service.js';
import { SuperadminSeedService } from './superadmin-seed.service.js';
/**
 * Everything that must be true before the API serves its first request, in the
 * order it must become true.
 *
 * ONE HOOK, NOT THREE. Nest gives no ordering between providers' lifecycle
 * hooks, and these are strictly sequential: the settings row needs tables that
 * the migrations create, and so does the superadmin. Three services each
 * implementing OnApplicationBootstrap would have run in whatever order the
 * container happened to resolve them — right by luck, until it was not.
 *
 * This hook runs inside `app.init()`, which `listen()` awaits, so all of it is
 * finished before the first request is accepted.
 *
 * WHAT STOPS THE BOOT AND WHAT DOES NOT
 *
 *   migrations   THROW. Serving against a half-applied schema is worse than
 *                not serving.
 *   settings row swallowed. The row almost certainly exists; refusing to start
 *                over a transient blip turns a hiccup into an outage, and the
 *                first query that needs it will say so more clearly.
 *   superadmin   THROW, but only on a configuration that is wrong — a bad
 *                national id, a placeholder password. Not configured at all is
 *                not an error.
 */
let BootstrapService = class BootstrapService {
    uow;
    migrations;
    superadmin;
    constructor(uow, migrations, superadmin) {
        this.uow = uow;
        this.migrations = migrations;
        this.superadmin = superadmin;
    }
    async onApplicationBootstrap() {
        await this.migrations.run();
        await this.ensureSettingsRow();
        await this.superadmin.ensure();
    }
    /**
     * The one row the schema cannot work without.
     *
     * `app_settings` is a single-row table pinned by `CHECK (id = 1)`, and every
     * read assumes the row is there — a missing one is not an empty settings
     * page, it is a check-in that cannot resolve its own thresholds.
     *
     * It is not a schema change, so it is not a migration: it is an invariant the
     * APPLICATION requires, asserted every start, idempotently — which keeps the
     * migrations what drizzle-kit generates, with nothing hand-written mixed in
     * that a regenerate would drop.
     */
    async ensureSettingsRow() {
        try {
            await this.uow.transaction(async (tx) => {
                await tx.insert(appSettings).values({ id: 1 }).onConflictDoNothing();
            });
        }
        catch (err) {
            console.error('[bootstrap] could not ensure the settings row', err);
        }
    }
};
BootstrapService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [UnitOfWorkService,
        MigrationService,
        SuperadminSeedService])
], BootstrapService);
export { BootstrapService };
//# sourceMappingURL=bootstrap.service.js.map