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
let HealthRepository = class HealthRepository {
    uow;
    constructor(uow) {
        this.uow = uow;
    }
    /** True if the database answers and the schema is in place. */
    async isReady() {
        const rows = await this.uow.transaction((db) => db.select({ id: appSettings.id }).from(appSettings).where(eq(appSettings.id, 1)).limit(1));
        return rows.length > 0;
    }
};
HealthRepository = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [UnitOfWorkService])
], HealthRepository);
export { HealthRepository };
//# sourceMappingURL=health.repository.js.map