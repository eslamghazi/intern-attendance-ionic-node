import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
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
@Injectable()
export class BootstrapService implements OnApplicationBootstrap {
  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly migrations: MigrationService,
    private readonly superadmin: SuperadminSeedService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
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
  private async ensureSettingsRow(): Promise<void> {
    try {
      await this.uow.transaction(async (tx) => {
        await tx.insert(appSettings).values({ id: 1 }).onConflictDoNothing();
      });
    } catch (err) {
      console.error('[bootstrap] could not ensure the settings row', err);
    }
  }
}
