var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { Inject, Injectable } from '@nestjs/common';
import { pool } from './pool.js';
/**
 * The connection pool, as an injectable.
 *
 * The pool is a module-level singleton — one per process is the only correct
 * number, and building it in a factory would not change that. What this token
 * changes is who is ALLOWED to reach it: the two places that genuinely need the
 * driver ask the container, and nothing else imports `db/pool.js` at all.
 *
 * That matters because "who can open a connection outside a transaction" is the
 * kind of thing that spreads quietly. A grep for PG_POOL now answers it.
 */
export const PG_POOL = Symbol('PG_POOL');
export const poolProvider = {
    provide: PG_POOL,
    useValue: pool,
};
/**
 * Closes the pool when Nest shuts down.
 *
 * A lifecycle hook rather than a `process.on('SIGTERM')` handler, because Nest
 * already sequences shutdown — controllers stop accepting, the scheduler clears
 * its timers — and the pool must close AFTER those, not alongside them. A bare
 * signal handler has no way to know when the rest of the application is done.
 *
 * `pool.end()` waits for checked-out clients to be released, so a job in flight
 * finishes rather than losing its connection underneath it.
 *
 * Requires `app.enableShutdownHooks()` in main.ts; without it Nest registers no
 * signal handler and no shutdown hook in the application ever fires.
 */
let PoolLifecycle = class PoolLifecycle {
    pool;
    constructor(pool) {
        this.pool = pool;
    }
    async onApplicationShutdown() {
        try {
            await this.pool.end();
        }
        catch (err) {
            // Shutting down is not the moment to fail: the process is going away and
            // Postgres reclaims the backends regardless.
            console.error('[db] error while closing the pool', err);
        }
    }
};
PoolLifecycle = __decorate([
    Injectable(),
    __param(0, Inject(PG_POOL)),
    __metadata("design:paramtypes", [Object])
], PoolLifecycle);
export { PoolLifecycle };
//# sourceMappingURL=pool.provider.js.map