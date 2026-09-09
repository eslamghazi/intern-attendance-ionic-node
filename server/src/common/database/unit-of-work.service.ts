import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { asCaller, asService, type DbContext, type JwtClaims } from '../../db/context.js';

export const dbContextStorage = new AsyncLocalStorage<DbContext>();

@Injectable()
export class UnitOfWorkService {
  /**
   * Runs the given work within a database transaction under the caller's context.
   */
  async asCaller<T>(claims: JwtClaims | null, work: () => Promise<T>): Promise<T> {
    return asCaller(claims, async (tx) => {
      return dbContextStorage.run(tx, work);
    });
  }

  /**
   * Runs the given work within a database transaction under the service context (elevated privileges).
   */
  async asService<T>(work: () => Promise<T>): Promise<T> {
    return asService(async (tx) => {
      return dbContextStorage.run(tx, work);
    });
  }
}
