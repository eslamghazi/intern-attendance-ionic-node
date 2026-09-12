import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { appSettings } from '../../infrastructure/database/schema/index.js';
import { UnitOfWorkService } from '../../infrastructure/database/unit-of-work.service.js';

/**
 * The readiness probe's one query.
 *
 * WAS `pool.query('select 1')` IN THE CONTROLLER. Two things were wrong with
 * that: a controller reached past the container straight to the driver — the
 * only route in the API that did — and `select 1` answers a weaker question
 * than readiness asks.
 *
 * READING app_settings INSTEAD. `select 1` proves a connection can be opened.
 * It says nothing about whether the schema is there, so a database that is up
 * but unmigrated reported READY and every real request then failed. Reading the
 * settings row proves the connection, the schema, and the one row the
 * application cannot start without — which is exactly the set of things that
 * must hold before this instance should be sent traffic.
 *
 * It is one indexed row by primary key. Kubernetes and Docker poll this every
 * few seconds; that cost is a rounding error, and an unmigrated instance being
 * kept out of the load balancer is worth far more.
 */
@Injectable()
export class HealthRepository {
  constructor(private readonly uow: UnitOfWorkService) {}

  /** True if the database answers and the schema is in place. */
  async isReady(): Promise<boolean> {
    const rows = await this.uow.transaction((db) =>
      db.select({ id: appSettings.id }).from(appSettings).where(eq(appSettings.id, 1)).limit(1),
    );
    return rows.length > 0;
  }
}
