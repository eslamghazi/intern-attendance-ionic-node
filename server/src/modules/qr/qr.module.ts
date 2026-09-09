import { Module } from '@nestjs/common';
import { QrController } from './qr.controller.js';
import { QrService } from './qr.service.js';
import { QrRepository } from './qr.repository.js';

@Module({
  controllers: [QrController],
  providers: [QrService, QrRepository],
  exports: [QrService, QrRepository],
})
export class QrModule {}
