import { Module } from '@nestjs/common';
import { TimeController } from './time.controller.js';
import { TimeService } from './time.service.js';
import { MembersModule } from '../members/members.module.js';

@Module({
  imports: [MembersModule],
  controllers: [TimeController],
  providers: [TimeService],
})
export class TimeModule {}
