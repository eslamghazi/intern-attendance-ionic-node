var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Global, Module } from '@nestjs/common';
import { IndexPageService } from './index-page.service.js';
/**
 * Global: bootstrap (main.ts) serves the index page through it, the
 * exception filter's SPA fallback does too, and SettingsController
 * invalidates it when the organisation's name or logo changes.
 */
let WebModule = class WebModule {
};
WebModule = __decorate([
    Global(),
    Module({
        providers: [IndexPageService],
        exports: [IndexPageService],
    })
], WebModule);
export { WebModule };
//# sourceMappingURL=web.module.js.map