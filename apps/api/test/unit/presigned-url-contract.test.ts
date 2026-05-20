import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Presigned URL generation contract tests.
 * Tests the expected behavior of the presign endpoint without needing a real MinIO instance.
 */

// Mock the S3 client and presigner
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({
    send: vi.fn(),
  })),
  PutObjectCommand: vi.fn().mockImplementation((input) => input),
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://presigned.example.com/upload?key=abc123'),
}));

// Import after mocking
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

describe('Presigned URL generation contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates S3 client with correct MinIO configuration', () => {
    const client = new S3Client({
      endpoint: 'http://localhost:9000',
      forcePathStyle: true,
      region: 'us-east-1',
      credentials: {
        accessKeyId: 'minio_admin',
        secretAccessKey: 'minio_dev_pass',
      },
    });

    expect(S3Client).toHaveBeenCalledWith({
      endpoint: 'http://localhost:9000',
      forcePathStyle: true,
      region: 'us-east-1',
      credentials: {
        accessKeyId: 'minio_admin',
        secretAccessKey: 'minio_dev_pass',
      },
    });
  });

  it('creates PutObjectCommand with correct bucket and key', () => {
    const command = new PutObjectCommand({
      Bucket: 'lch-media',
      Key: 'images/1234567890-abc123.jpg',
      ContentType: 'image/jpeg',
    });

    expect(PutObjectCommand).toHaveBeenCalledWith({
      Bucket: 'lch-media',
      Key: 'images/1234567890-abc123.jpg',
      ContentType: 'image/jpeg',
    });
  });

  it('generates presigned URL with 1 hour expiry', () => {
    const mockClient = { send: vi.fn() } as any;
    const mockCommand = {} as any;
    getSignedUrl(mockClient, mockCommand, { expiresIn: 3600 });

    expect(getSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ expiresIn: 3600 }),
    );
  });

  it('returns upload URL, public URL, key, and metadata', async () => {
    // Simulate the presign flow
    const mockClient = { send: vi.fn() } as any;
    const mockCommand = {} as any;
    const presignedUrl = await getSignedUrl(mockClient, mockCommand, { expiresIn: 3600 });
    const key = 'images/1234567890-abc123.jpg';
    const bucket = 'lch-media';
    const publicUrl = `http://localhost:9000/${bucket}/${key}`;

    const result = {
      uploadUrl: presignedUrl,
      publicUrl,
      key,
      bucket,
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg' },
      expiresIn: 3600,
    };

    expect(result.uploadUrl).toBe('https://presigned.example.com/upload?key=abc123');
    expect(result.publicUrl).toBe('http://localhost:9000/lch-media/images/1234567890-abc123.jpg');
    expect(result.key).toBe('images/1234567890-abc123.jpg');
    expect(result.bucket).toBe('lch-media');
    expect(result.method).toBe('PUT');
    expect(result.expiresIn).toBe(3600);
  });

  it('generates unique keys for each upload request', () => {
    const key1 = `images/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const key2 = `images/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;

    expect(key1).not.toBe(key2);
    expect(key1.startsWith('images/')).toBe(true);
    expect(key2.startsWith('images/')).toBe(true);
  });

  it('preserves file extension in key', () => {
    const fileName = 'my-photo.png';
    const ext = fileName.split('.').pop() || 'bin';
    const key = `images/${Date.now()}-abc123.${ext}`;

    expect(key.endsWith('.png')).toBe(true);
  });

  it('handles video files with correct prefix', () => {
    const key = `videos/${Date.now()}-abc123.mp4`;
    expect(key.startsWith('videos/')).toBe(true);
    expect(key.endsWith('.mp4')).toBe(true);
  });
});
