var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Injectable } from '@nestjs/common';
import { transaction, dbContextStorage } from './context.js';
export { dbContextStorage };
/**
 * One transaction, injectable.
 *
 * ONE method on purpose. A second entry point named for a privilege level reads
 * as a security boundary, and this layer has none to offer: every caller reaches
 * the same database role with the same rights. A name implying a boundary that
 * is not there is worse than no name at all, because it invites callers to rely
 * on it.
 *
 * Authorization happens before a query is built — the guards in
 * src/common/guards and the scope helpers in src/domain/access — never here.
 */
let UnitOfWorkService = class UnitOfWorkService {
    /**
     * Run `work` inside a transaction, joining one already open on this context.
     *
     * `work` is HANDED the transaction as well as having it on the async context.
     * Repositories read it from the context — that is what lets a repository
     * method be called from anywhere without threading a handle through every
     * signature — but a caller that needs the handle directly (the scheduler, the
     * bootstrap insert) used to reach into `dbContextStorage.getStore()!`, with a
     * non-null assertion standing in for a guarantee. Passing it removes both.
     *
     * A `() => …` callback still satisfies this, so the 120-odd existing callers
     * that ignore the argument are unaffected.
     */
    async transaction(work) {
        return transaction(async (db) => work(db));
    }
};
UnitOfWorkService = __decorate([
    Injectable()
], UnitOfWorkService);
export { UnitOfWorkService };
//# sourceMappingURL=unit-of-work.service.js.map