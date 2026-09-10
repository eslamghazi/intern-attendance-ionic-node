var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Module } from '@nestjs/common';
import { TimeController } from './time.controller.js';
import { TimeService } from './time.service.js';
import { MembersModule } from '../members/members.module.js';
let TimeModule = class TimeModule {
};
TimeModule = __decorate([
    Module({
        imports: [MembersModule],
        controllers: [TimeController],
        providers: [TimeService],
    })
], TimeModule);
export { TimeModule };
//# sourceMappingURL=time.module.js.map