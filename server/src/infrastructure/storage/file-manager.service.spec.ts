import { describe, expect, it, vi, beforeEach } from 'vitest';
import { FileManager, FileCategory } from './file-manager.service.js';

describe('FileManager', () => {
  let fileManager: FileManager;

  beforeEach(() => {
    fileManager = new FileManager();
  });

  it('identifies public categories correctly', () => {
    expect(fileManager.isPublic(FileCategory.AVATAR)).toBe(true);
    expect(fileManager.isPublic(FileCategory.FACE)).toBe(false);
    expect(fileManager.isPublic(FileCategory.PROBE)).toBe(false);
    expect(fileManager.isPublic(FileCategory.DOCUMENT)).toBe(false);
    expect(fileManager.isPublic(FileCategory.ATTENDANCE)).toBe(false);
  });

  it('generates direct url for public category', () => {
    const url = fileManager.getUrl(FileCategory.AVATAR, 'user-1/profile.jpg');
    expect(url).toContain('/storage/avatars/object?path=user-1%2Fprofile.jpg');
  });

  it('generates signed url for private category', () => {
    const url = fileManager.getUrl(FileCategory.FACE, 'user-1/face.jpg');
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
    await expect(fileManager.download(FileCategory.AVATAR, '../../etc/passwd')).rejects.toThrow('object not found');
  });
});
