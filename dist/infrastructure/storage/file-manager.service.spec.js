import { describe, expect, it, beforeEach } from 'vitest';
import { FileManager } from './file-manager.service.js';
describe('FileManager', () => {
    let fileManager;
    beforeEach(() => {
        // Every case here is path and URL arithmetic — none of them opens a
        // transaction. A stub that throws says so, and would fail loudly rather
        // than silently if one ever started to.
        const uow = {
            transaction: () => {
                throw new Error('FileManager unexpectedly opened a transaction in this test');
            },
        };
        fileManager = new FileManager(uow);
    });
    it('identifies public categories correctly', () => {
        expect(fileManager.isPubliclyReadable('avatars')).toBe(true);
        expect(fileManager.isPubliclyReadable('faces')).toBe(false);
        expect(fileManager.isPubliclyReadable('probes')).toBe(false);
    });
    it('generates direct url for public kind', () => {
        const url = fileManager.getUrl('avatars', 'user-1/profile.jpg');
        expect(url).toContain('/storage/avatars/object?path=user-1%2Fprofile.jpg');
    });
    it('generates signed url for private kind', () => {
        const url = fileManager.getUrl('faces', 'user-1/face.jpg');
        expect(url).toContain('/storage/faces/object?');
        expect(url).toContain('signature=');
        expect(url).toContain('expires=');
    });
    it('decodes base64 image content correctly', () => {
        const original = 'Hello World Base64';
        const b64 = `data:image/jpeg;base64,${Buffer.from(original).toString('base64')}`;
        const decoded = fileManager.decodeBase64Image(b64);
        expect(decoded).not.toBeNull();
        expect(decoded?.toString('utf-8')).toBe(original);
    });
    it('returns null for invalid or empty base64 string', () => {
        expect(fileManager.decodeBase64Image('')).toBeNull();
    });
    it('throws not found on path traversal attempt', async () => {
        await expect(fileManager.download('avatars', '../../etc/passwd')).rejects.toThrow('object not found');
    });
});
//# sourceMappingURL=file-manager.service.spec.js.map