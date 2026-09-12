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
import { eq } from 'drizzle-orm';
import { UnitOfWorkService } from '../../infrastructure/database/unit-of-work.service.js';
import * as schema from '../../infrastructure/database/schema/index.js';
import { bearerToken, verifyToken } from '../auth/jwt.js';
let AuthMiddleware = class AuthMiddleware {
    uow;
    constructor(uow) {
        this.uow = uow;
    }
    async use(req, res, next) {
        req.caller = null;
        req.claims = null;
        if (req.raw) {
            req.raw.caller = null;
            req.raw.claims = null;
        }
        const authHeader = req.headers?.authorization ?? req.raw?.headers?.authorization;
        const token = bearerToken(authHeader);
        if (!token) {
            return next();
        }
        const claims = verifyToken(token);
        if (!claims) {
            return next();
        }
        try {
            const profile = await this.uow.transaction(async (tx) => {
                const rows = await tx
                    .select({ role: schema.profiles.role, isActive: schema.profiles.isActive })
                    .from(schema.profiles)
                    .where(eq(schema.profiles.id, claims.sub))
                    .limit(1);
                return rows[0] ?? null;
            });
            if (profile && profile.isActive !== false) {
                const caller = {
                    id: claims.sub,
                    role: profile.role,
                    nationalId: claims.national_id,
                };
                const claimsWithRole = { ...claims, user_role: profile.role };
                req.caller = caller;
                req.claims = claimsWithRole;
                if (req.raw) {
                    req.raw.caller = caller;
                    req.raw.claims = claimsWithRole;
                }
            }
        }
        catch (err) {
            console.error('[AuthMiddleware] Error reading profile:', err);
        }
        next();
    }
};
AuthMiddleware = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [UnitOfWorkService])
], AuthMiddleware);
export { AuthMiddleware };
//# sourceMappingURL=auth.middleware.js.map