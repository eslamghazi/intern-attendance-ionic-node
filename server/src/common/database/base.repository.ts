import { dbContextStorage } from './unit-of-work.service.js';
import { type DbContext } from '../../db/context.js';

export abstract class BaseRepository {
  /**
   * Gets the active database transaction context.
   * Throws an error if called outside of a UnitOfWork.
   */
  protected get db(): DbContext {
    const tx = dbContextStorage.getStore();
    if (!tx) {
      throw new Error('Repository methods must be called within a UnitOfWork (asCaller or asService).');
    }
    return tx;
  }
}
