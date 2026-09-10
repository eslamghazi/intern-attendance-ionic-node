var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Injectable } from '@nestjs/common';
import { asCaller, asService, dbContextStorage } from '../../db/context.js';
export { dbContextStorage };
let UnitOfWorkService = class UnitOfWorkService {
    /**
     * Runs the given work within a database transaction under the caller's context.
     */
    async asCaller(claims, work) {
        return asCaller(claims, async () => work());
    }
    /**
     * Runs the given work within a database transaction under the service context (elevated privileges).
     */
    async asService(work) {
        return asService(async () => work());
    }
};
UnitOfWorkService = __decorate([
    Injectable()
], UnitOfWorkService);
export { UnitOfWorkService };
//# sourceMappingURL=unit-of-work.service.js.map