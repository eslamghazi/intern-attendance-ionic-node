import { Injectable } from '@nestjs/common';
import { asCaller, asService, dbContextStorage, type DbContext, type JwtClaims } from '../../db/context.js';

export { dbContextStorage };

@Injectable()
export class UnitOfWorkService {
  /**
   * Runs the given work within a database transaction under the caller's context.
   */
  async asCaller<T>(claims: JwtClaims | null, work: () => Promise<T>): Promise<T> {
    return asCaller(claims, async () => work());
  }

  /**
   * Runs the given work within a database transaction under the service context (elevated privileges).
   */
  async asService<T>(work: () => Promise<T>): Promise<T> {
    return asService(async () => work());
  }
}
