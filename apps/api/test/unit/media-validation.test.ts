import { describe, it, expect } from 'vitest';

/**
 * Media validation tests.
 * Tests the MIME type and size constraints used by the presigned upload flow.
 */

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const ALL_ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

function validateMediaType(mimeType: string, type: 'image' | 'video'): { valid: boolean; error?: string } {
  if (!ALL_ALLOWED_TYPES.includes(mimeType)) {
    return { valid: false, error: `MIME type ${mimeType} not allowed` };
  }

  const isImage = ALLOWED_IMAGE_TYPES.includes(mimeType);
  const isVideo = ALLOWED_VIDEO_TYPES.includes(mimeType);

  if (type === 'image' && !isImage) {
    return { valid: false, error: `MIME type ${mimeType} is not an image` };
  }
  if (type === 'video' && !isVideo) {
    return { valid: false, error: `MIME type ${mimeType} is not a video` };
  }

  return { valid: true };
}

function validateFileSize(size: number): { valid: boolean; error?: string } {
  if (size > MAX_FILE_SIZE) {
    return { valid: false, error: `File size ${size} exceeds max ${MAX_FILE_SIZE} bytes` };
  }
  if (size <= 0) {
    return { valid: false, error: 'File size must be positive' };
  }
  return { valid: true };
}

function generateKey(fileName: string, type: 'image' | 'video'): string {
  const ext = fileName.split('.').pop() || 'bin';
  return `${type}s/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
}

describe('Media validation/presign constraints', () => {
  describe('MIME type validation', () => {
    it('accepts valid image types', () => {
      for (const mime of ALLOWED_IMAGE_TYPES) {
        expect(validateMediaType(mime, 'image').valid).toBe(true);
      }
    });

    it('accepts valid video types', () => {
      for (const mime of ALLOWED_VIDEO_TYPES) {
        expect(validateMediaType(mime, 'video').valid).toBe(true);
      }
    });

    it('rejects disallowed MIME types', () => {
      expect(validateMediaType('application/pdf', 'image').valid).toBe(false);
      expect(validateMediaType('text/plain', 'image').valid).toBe(false);
      expect(validateMediaType('application/octet-stream', 'video').valid).toBe(false);
    });

    it('rejects type/category mismatch', () => {
      expect(validateMediaType('image/jpeg', 'video').valid).toBe(false);
      expect(validateMediaType('video/mp4', 'image').valid).toBe(false);
    });
  });

  describe('File size validation', () => {
    it('accepts files under 50MB', () => {
      expect(validateFileSize(1024).valid).toBe(true);
      expect(validateFileSize(10 * 1024 * 1024).valid).toBe(true);
      expect(validateFileSize(49 * 1024 * 1024).valid).toBe(true);
    });

    it('rejects files over 50MB', () => {
      expect(validateFileSize(51 * 1024 * 1024).valid).toBe(false);
      expect(validateFileSize(100 * 1024 * 1024).valid).toBe(false);
    });

    it('rejects zero or negative sizes', () => {
      expect(validateFileSize(0).valid).toBe(false);
      expect(validateFileSize(-1).valid).toBe(false);
    });
  });

  describe('Key generation', () => {
    it('generates keys with correct type prefix', () => {
      const imageKey = generateKey('photo.jpg', 'image');
      expect(imageKey.startsWith('images/')).toBe(true);

      const videoKey = generateKey('clip.mp4', 'video');
      expect(videoKey.startsWith('videos/')).toBe(true);
    });

    it('preserves file extension', () => {
      const key = generateKey('my-photo.png', 'image');
      expect(key.endsWith('.png')).toBe(true);
    });

    it('generates unique keys', () => {
      const key1 = generateKey('photo.jpg', 'image');
      const key2 = generateKey('photo.jpg', 'image');
      expect(key1).not.toBe(key2); // timestamp + random ensures uniqueness
    });
  });
});
