var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Injectable } from '@nestjs/common';
import { UnitOfWorkService } from '../../infrastructure/database/unit-of-work.service.js';
import { StorageRepository } from './storage.repository.js';
import { FileManager } from '../../infrastructure/storage/file-manager.service.js';
import { FILE_KIND_NAMES } from '../../config/constants.js';
let StorageService = class StorageService {
    uow;
    repo;
    fileManager;
    constructor(uow, repo, fileManager) {
        this.uow = uow;
        this.repo = repo;
        this.fileManager = fileManager;
    }
    async uploadObject(caller, claims, kind, path, bytes, contentType) {
        return this.fileManager.upload({
            kind,
            path,
            body: bytes,
            contentType,
            owner: caller.id,
            claims,
        });
    }
    async deleteObjects(kind, paths) {
        await this.fileManager.delete(kind, paths);
        await this.uow.transaction(async () => {
            await this.repo.clearObjectPaths(paths);
        });
    }
    /**
     * Delete probe captures older than `days`. Returns how many went.
     *
     * WHY THIS EXISTS
     *
     * A probe is the photo taken at the moment of a check-in, kept so a disputed
     * attendance can be looked at. One per check-in and one per check-out, for
     * every member, every day — and until now nothing ever deleted one. A few
     * hundred members produce tens of thousands of FACE IMAGES a term, growing
     * without limit.
     *
     * That is two problems, and the second is the serious one: an indefinite pile
     * of biometric images of students is a liability that grows on its own. The
     * reason to keep a probe is to settle a dispute about a specific day, and
     * that reason expires.
     *
     * Faces and avatars are NOT touched. A face template's photo is the enrolment
     * itself and has no expiry; an avatar is the member's own picture.
     *
     * The attendance row survives — only the image goes, and the column that
     * pointed at it is nulled so nothing is left holding a path to a file that is
     * not there.
     */
    async pruneProbes(days, cap) {
        const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
        const paths = await this.uow.transaction(() => this.repo.probesOlderThan(cutoff, cap));
        if (!paths.length)
            return 0;
        await this.fileManager.delete('probes', paths);
        await this.uow.transaction(() => this.repo.clearObjectPaths(paths));
        return paths.length;
    }
    /**
     * Compare what the database says it has against what is on disk.
     *
     * REPORTS, never deletes. The two ways they can disagree have opposite
     * causes and opposite risks:
     *
     *   missing   a row whose file is gone. The signed URL for it will 404. Bad,
     *             but the row is the only remaining evidence the file existed —
     *             deleting it destroys that too.
     *   orphaned  a file with no row. Unreachable through the API, so it is only
     *             taking disk. Deleting it is TEMPTING and is exactly the thing
     *             not to automate: a bug that stops writing rows would turn this
     *             into a job that deletes every file the system just uploaded.
     *
     * So it counts, logs and stops. Acting on the numbers is a decision a person
     * makes with the numbers in front of them.
     */
    async reconcile() {
        // Every declared kind, so adding one cannot leave it unreconciled.
        const kinds = FILE_KIND_NAMES;
        const report = {};
        for (const kind of kinds) {
            const recorded = await this.uow.transaction(() => this.repo.pathsInKind(kind));
            const onDisk = await this.fileManager.listOnDisk(kind);
            const diskSet = new Set(onDisk);
            const rowSet = new Set(recorded);
            report[kind] = {
                rows: recorded.length,
                onDisk: onDisk.length,
                missing: recorded.filter((p) => !diskSet.has(p)).length,
                orphaned: onDisk.filter((p) => !rowSet.has(p)).length,
            };
        }
        return report;
    }
};
StorageService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [UnitOfWorkService,
        StorageRepository,
        FileManager])
], StorageService);
export { StorageService };
//# sourceMappingURL=storage.service.js.map