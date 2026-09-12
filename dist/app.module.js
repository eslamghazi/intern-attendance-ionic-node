var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AuthMiddleware } from './common/middleware/auth.middleware.js';
import { ApiExceptionFilter } from './common/filters/api-exception.filter.js';
import { AuthGuard } from './common/guards/auth.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { PermissionsGuard } from './common/guards/permissions.guard.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { TimeModule } from './modules/time/time.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { ProfileModule } from './modules/profile/profile.module.js';
import { SettingsModule } from './modules/settings/settings.module.js';
import { DepartmentsModule } from './modules/departments/departments.module.js';
import { SuperadminModule } from './modules/superadmin/superadmin.module.js';
import { AdminsModule } from './modules/admins/admins.module.js';
import { MembersModule } from './modules/members/members.module.js';
import { StorageModule } from './modules/storage/storage.module.js';
import { FaceModule } from './modules/face/face.module.js';
import { QrModule } from './modules/qr/qr.module.js';
import { PresenceModule } from './modules/presence/presence.module.js';
import { AttendanceModule } from './modules/attendance/attendance.module.js';
import { RosterModule } from './modules/roster/roster.module.js';
import { ReportsModule } from './modules/reports/reports.module.js';
import { DatabaseModule } from './infrastructure/database/database.module.js';
import { FileManagerModule } from './infrastructure/storage/file-manager.module.js';
import { SchedulerModule } from './infrastructure/scheduler/scheduler.module.js';
import { I18nModule } from './common/i18n/i18n.module.js';
let AppModule = class AppModule {
    configure(consumer) {
        consumer.apply(AuthMiddleware).forRoutes('*');
    }
};
AppModule = __decorate([
    Module({
        imports: [
            I18nModule,
            FileManagerModule,
            DatabaseModule,
            AuditModule,
            HealthModule,
            TimeModule,
            AuthModule,
            CatalogModule,
            ProfileModule,
            SettingsModule,
            DepartmentsModule,
            AdminsModule,
            SuperadminModule,
            MembersModule,
            StorageModule,
            FaceModule,
            QrModule,
            PresenceModule,
            AttendanceModule,
            RosterModule,
            ReportsModule,
            // Last: it depends on the modules above and starts timers at bootstrap.
            SchedulerModule,
        ],
        providers: [
            {
                provide: APP_FILTER,
                useClass: ApiExceptionFilter,
            },
            {
                provide: APP_GUARD,
                useClass: AuthGuard,
            },
            {
                provide: APP_GUARD,
                useClass: RolesGuard,
            },
            // After RolesGuard on purpose: by the time this runs, the caller is known
            // to be a kind of account the route accepts, and the only question left
            // is whether an ADMIN holds the page.
            {
                provide: APP_GUARD,
                useClass: PermissionsGuard,
            },
        ],
    })
], AppModule);
export { AppModule };
//# sourceMappingURL=app.module.js.map