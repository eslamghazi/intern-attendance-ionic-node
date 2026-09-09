import { Controller, Get, Res, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator.js';
import { pool } from '../../db/pool.js';

@Controller()
export class HealthController {
  @Public()
  @Get('health')
  getHealth() {
    return { ok: true };
  }

  @Public()
  @Get('health/ready')
  async getReady(@Res() res: Response) {
    try {
      await pool.query('select 1');
      return res.status(HttpStatus.OK).json({ ok: true, db: true });
    } catch {
      return res.status(HttpStatus.SERVICE_UNAVAILABLE).json({ ok: false, db: false });
    }
  }

  @Public()
  @Get('api/v1/health')
  getApiHealth() {
    return { ok: true };
  }

  @Public()
  @Get('api/v1/health/ready')
  async getApiReady(@Res() res: Response) {
    return this.getReady(res);
  }
}
