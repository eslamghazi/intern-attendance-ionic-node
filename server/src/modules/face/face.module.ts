import { Module } from '@nestjs/common';
import { FaceController } from './face.controller.js';
import { FaceService } from './face.service.js';
import { FaceRepository } from './face.repository.js';

import { MembersModule } from '../members/members.module.js';

@Module({
  imports: [MembersModule],
  controllers: [FaceController],
  providers: [FaceService, FaceRepository],
  exports: [FaceService, FaceRepository],
})
export class FaceModule {}
