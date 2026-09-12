import { dbContextStorage } from './unit-of-work.service.js';
export class BaseRepository {
    /**
     * Gets the active database transaction context.
     * Throws an error if called outside of a UnitOfWork.
     */
    get db() {
        const tx = dbContextStorage.getStore();
        if (!tx) {
            throw new Error('Repository methods must be called inside UnitOfWorkService.transaction().');
        }
        return tx;
    }
}
//# sourceMappingURL=base.repository.js.map