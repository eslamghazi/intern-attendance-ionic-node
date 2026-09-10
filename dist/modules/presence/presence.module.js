var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Module } from '@nestjs/common';
import { PresenceController } from './presence.controller.js';
import { PresenceService } from './presence.service.js';
import { PresenceRepository } from './presence.repository.js';
let PresenceModule = class PresenceModule {
};
PresenceModule = __decorate([
    Module({
        controllers: [PresenceController],
        providers: [PresenceService, PresenceRepository],
        exports: [PresenceService, PresenceRepository],
    })
], PresenceModule);
export { PresenceModule };
//# sourceMappingURL=presence.module.js.map