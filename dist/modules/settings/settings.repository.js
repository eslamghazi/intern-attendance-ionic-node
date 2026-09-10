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
import { GenericRepository } from '../../common/database/generic.repository.js';
import { eq } from 'drizzle-orm';
import { appSettings } from '../../db/schema/index.js';
let SettingsRepository = class SettingsRepository extends GenericRepository {
    constructor() {
        super(appSettings, appSettings.id);
    }
    async getSettings() {
        return this.findById(1);
    }
    async getBranding() {
        const rows = await this.db
            .select({
            orgName: appSettings.orgName,
            orgLogoUrl: appSettings.orgLogoUrl,
            terminology: appSettings.terminology,
            memberPhotos: appSettings.memberPhotos,
        })
            .from(appSettings)
            .where(eq(appSettings.id, 1));
        return rows[0] ?? null;
    }
    async updateSettings(updateObj) {
        await this.update(1, updateObj);
    }
};
SettingsRepository = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [])
], SettingsRepository);
export { SettingsRepository };
//# sourceMappingURL=settings.repository.js.map