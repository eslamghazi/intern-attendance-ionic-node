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
import { UnitOfWorkService } from '../../infrastructure/database/unit-of-work.service.js';
import { AuditRepository } from './audit.repository.js';
import { scopeOf } from '../../common/auth/access.service.js';
import { forbidden } from '../../common/errors.js';
import { isStaff } from '../../domain/identity/role.js';
/**
 * The audit trail: one writer, and one guarded reader.
 *
 * WHY THERE IS A READER AT ALL
 *
 * There was not one. The table recorded mock_location_detected, face_mismatch,
 * master_login and refresh-token reuse — the evidence for exactly the behaviour
 * someone would want to bury — and no endpoint, screen or report could reach
 * it. A trail nobody can read is a cost with no benefit: it takes the disk, the
 * write on the check-in hot path and the privacy exposure, and returns nothing.
 */
let AuditService = class AuditService {
    uow;
    repo;
    constructor(uow, repo) {
        this.uow = uow;
        this.repo = repo;
    }
    /**
     * Record an event.
     *
     * Joins the caller's open transaction when there is one, so an event written
     * during a check-in commits or rolls back WITH the check-in. A refusal that
     * rolled back would otherwise leave an audit row claiming something happened
     * that did not.
     */
    async record(actorId, event, detail = null) {
        // No "am I already in a transaction?" test here: UnitOfWorkService JOINS an
        // open one rather than nesting, so the two branches this used to have were
        // the same call written twice.
        return this.uow.transaction(() => this.repo.record(actorId, event, detail));
    }
    /**
     * A page of the trail.
     *
     * Members never reach this — not even for their own events. Their refusals
     * are already shown to them as they happen, and the trail's value is that it
     * records what someone would rather it did not.
     */
    async list(caller, filters, limit, offset) {
        if (!isStaff(caller.role))
            throw forbidden('not allowed');
        return this.uow.transaction(async (tx) => {
            const scope = await scopeOf(tx, caller);
            const { rows, total } = await this.repo.findPage(scope, filters, limit, offset);
            return {
                rows: rows.map((r) => ({
                    id: r.id,
                    event: r.event,
                    actor_id: r.actor_id,
                    actor_name: r.actor_name ?? null,
                    actor_national_id: r.actor_national_id ?? null,
                    actor_role: r.actor_role ?? null,
                    detail: r.detail ?? null,
                    created_at: r.created_at,
                })),
                total,
            };
        });
    }
    /** Counts per event for the same filters — the summary above the table. */
    async summary(caller, filters) {
        if (!isStaff(caller.role))
            throw forbidden('not allowed');
        return this.uow.transaction(async (tx) => {
            const scope = await scopeOf(tx, caller);
            const rows = await this.repo.countByEvent(scope, filters);
            const out = {};
            for (const r of rows)
                out[r.event] = Number(r.n);
            return out;
        });
    }
    /** Retention. Called by the scheduler; see infrastructure/scheduler. */
    async prune(days, cap) {
        return this.uow.transaction(() => this.repo.deleteOlderThan(days, cap));
    }
};
AuditService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [UnitOfWorkService,
        AuditRepository])
], AuditService);
export { AuditService };
//# sourceMappingURL=audit.service.js.map