import { IsString, IsOptional, IsIn, IsInt, Max } from 'class-validator';

export class CreatePresignDto {
  @IsString()
  @IsIn(['image', 'video'])
  type: 'image' | 'video';

  @IsString()
  fileName: string;

  @IsString()
  mimeType: string;

  @IsInt()
  @Max(50 * 1024 * 1024) // 50MB max
  size: number;

  @IsOptional()
  @IsString()
  matchDate?: string; // YYYY-MM-DD for football media
}

export class CreateMediaDto {
  @IsString()
  title: string;

  @IsString()
  @IsIn(['image', 'video'])
  type: 'image' | 'video';

  @IsString()
  url: string;

  @IsString()
  mimeType: string;

  @IsInt()
  size: number;

  @IsOptional()
  @IsString()
  matchDate?: string;
}
