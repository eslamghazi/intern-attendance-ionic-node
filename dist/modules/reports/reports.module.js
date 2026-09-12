var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module.js';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';
import { ReportsRepository } from './reports.repository.js';
let ReportsModule = class ReportsModule {
};
ReportsModule = __decorate([
    Module({
        // The dashboard export reads the caller's SCOPED catalog for its names and
        // counts, rather than restating the scoping rules here.
        imports: [CatalogModule],
        controllers: [ReportsController],
        providers: [ReportsService, ReportsRepository],
        exports: [ReportsService, ReportsRepository],
    })
], ReportsModule);
export { ReportsModule };
//# sourceMappingURL=reports.module.js.map