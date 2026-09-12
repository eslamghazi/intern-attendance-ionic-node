import { Global, Module } from '@nestjs/common';
import { IndexPageService } from './index-page.service.js';

/**
 * Global: bootstrap (main.ts) serves the index page through it, the
 * exception filter's SPA fallback does too, and SettingsController
 * invalidates it when the organisation's name or logo changes.
 */
@Global()
@Module({
  providers: [IndexPageService],
  exports: [IndexPageService],
})
export class WebModule {}
