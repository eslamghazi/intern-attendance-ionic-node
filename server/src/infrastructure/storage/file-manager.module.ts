import { Module, Global } from '@nestjs/common';
import { FileManager } from './file-manager.service.js';

@Global()
@Module({
  providers: [FileManager],
  exports: [FileManager],
})
export class FileManagerModule {}
