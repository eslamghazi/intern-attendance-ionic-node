var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Global, Module } from '@nestjs/common';
import { I18nService } from './i18n.service.js';
let I18nModule = class I18nModule {
};
I18nModule = __decorate([
    Global(),
    Module({
        providers: [I18nService],
        exports: [I18nService],
    })
], I18nModule);
export { I18nModule };
//# sourceMappingURL=i18n.module.js.map