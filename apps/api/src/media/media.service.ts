import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';
import { CreatePresignDto, CreateMediaDto } from './dto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Allowed MIME types
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const ALL_ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

@Injectable()
export class MediaService {
  private s3Client: S3Client;
  private bucketMedia: string;
  private endpoint: string;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.endpoint = this.config.get<string>('MINIO_ENDPOINT', 'localhost');
    const port = parseInt(this.config.get<string>('MINIO_PORT', '9000'), 10);
    const accessKey = this.config.get<string>('MINIO_ACCESS_KEY', 'minio_admin');
    const secretKey = this.config.get<string>('MINIO_SECRET_KEY', 'minio_dev_pass');
    const useSsl = this.config.get<string>('MINIO_USE_SSL', 'false') === 'true';
    this.bucketMedia = this.config.get<string>('MINIO_BUCKET_MEDIA', 'lch-media');

    this.s3Client = new S3Client({
      endpoint: `${useSsl ? 'https' : 'http'}://${this.endpoint}:${port}`,
      forcePathStyle: true, // Required for MinIO
      region: 'us-east-1', // MinIO default
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
    });
  }

  /**
   * Generate a real presigned PUT URL using AWS SDK v3.
   * The client uploads directly to MinIO, then calls POST /media/confirm
   * to persist metadata.
   */
  async createPresignedUpload(dto: CreatePresignDto) {
    // Validate MIME type
    if (!ALL_ALLOWED_TYPES.includes(dto.mimeType)) {
      throw new BadRequestException(
        `MIME type ${dto.mimeType} not allowed. Allowed: ${ALL_ALLOWED_TYPES.join(', ')}`,
      );
    }

    // Validate size
    if (dto.size > MAX_FILE_SIZE) {
      throw new BadRequestException(`File size ${dto.size} exceeds max ${MAX_FILE_SIZE} bytes`);
    }

    // Validate type matches MIME category
    const isImage = ALLOWED_IMAGE_TYPES.includes(dto.mimeType);
    const isVideo = ALLOWED_VIDEO_TYPES.includes(dto.mimeType);
    if (dto.type === 'image' && !isImage) {
      throw new BadRequestException(`MIME type ${dto.mimeType} is not an image`);
    }
    if (dto.type === 'video' && !isVideo) {
      throw new BadRequestException(`MIME type ${dto.mimeType} is not a video`);
    }

    // Generate unique key
    const ext = dto.fileName.split('.').pop() || 'bin';
    const key = `${dto.type}s/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    // Generate real presigned URL using AWS SDK v3
    const command = new PutObjectCommand({
      Bucket: this.bucketMedia,
      Key: key,
      ContentType: dto.mimeType,
    });

    const presignedUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: 3600, // 1 hour
    });

    // Build the public URL for the confirm step
    const protocol = this.config.get<string>('MINIO_USE_SSL', 'false') === 'true' ? 'https' : 'http';
    const publicUrl = `${protocol}://${this.endpoint}:${this.config.get<string>('MINIO_PORT', '9000')}/${this.bucketMedia}/${key}`;

    return {
      uploadUrl: presignedUrl,
      publicUrl,
      key,
      bucket: this.bucketMedia,
      method: 'PUT',
      headers: {
        'Content-Type': dto.mimeType,
      },
      expiresIn: 3600,
    };
  }

  /**
   * Confirm an upload and persist media metadata.
   * Called by client after successful direct upload to MinIO.
   */
  async confirmUpload(key: string, dto: CreateMediaDto) {
    return this.prisma.mediaItem.create({
      data: {
        title: dto.title,
        type: dto.type,
        url: dto.url,
        mimeType: dto.mimeType,
        size: dto.size,
        key,
        bucket: this.bucketMedia,
        matchDate: dto.matchDate,
      },
    });
  }

  async findAll(type?: string, matchDate?: string) {
    return this.prisma.mediaItem.findMany({
      where: {
        ...(type ? { type } : {}),
        ...(matchDate ? { matchDate } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const item = await this.prisma.mediaItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`Media item ${id} not found`);
    return item;
  }

  async delete(id: string) {
    await this.findById(id);
    return this.prisma.mediaItem.delete({ where: { id } });
  }
}
