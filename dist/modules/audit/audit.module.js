var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Global, Module } from '@nestjs/common';
import { AuditController } from './audit.controller.js';
import { AuditService } from './audit.service.js';
import { AuditRepository } from './audit.repository.js';
/**
 * Global, because almost every module has something worth recording and the
 * alternative is importing AuditModule into a dozen others — which is how the
 * two duplicate writers appeared in the first place.
 */
let AuditModule = class AuditModule {
};
AuditModule = __decorate([
    Global(),
    Module({
        controllers: [AuditController],
        providers: [AuditService, AuditRepository],
        exports: [AuditService, AuditRepository],
    })
], AuditModule);
export { AuditModule };
//# sourceMappingURL=audit.module.js.map