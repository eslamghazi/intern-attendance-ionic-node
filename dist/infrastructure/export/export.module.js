var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Global, Module } from '@nestjs/common';
import { ExportService } from './export.service.js';
/** Global, like the database it reads: every module with an export route uses it. */
let ExportModule = class ExportModule {
};
ExportModule = __decorate([
    Global(),
    Module({
        providers: [ExportService],
        exports: [ExportService],
    })
], ExportModule);
export { ExportModule };
//# sourceMappingURL=export.module.js.map