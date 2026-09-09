import { Module } from '@nestjs/common';
import { RosterController } from './roster.controller.js';
import { RosterService } from './roster.service.js';
import { RosterRepository } from './roster.repository.js';

@Module({
  controllers: [RosterController],
  providers: [RosterService, RosterRepository],
  exports: [RosterService, RosterRepository],
})
export class RosterModule {}
