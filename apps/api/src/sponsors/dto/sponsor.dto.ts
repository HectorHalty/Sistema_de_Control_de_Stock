import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

const PLACEMENTS = ['home', 'cantina', 'banner', 'sidebar', 'footer'] as const;
const MEDIA = ['image', 'video'] as const;

export class CreateSponsorDto {
  @IsString() name!: string;
  @IsString() imageUrl!: string;
  @IsOptional() @IsIn(PLACEMENTS) placement?: string;
  @IsOptional() @IsString() linkUrl?: string;
  @IsOptional() @IsString() bannerLabel?: string;
  @IsOptional() @IsIn(MEDIA) mediaType?: string;
  @IsOptional() @IsInt() widthPx?: number;
  @IsOptional() @IsInt() heightPx?: number;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsInt() @Min(2) @Max(60) durationSeconds?: number;
}

export class UpdateSponsorDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsIn(PLACEMENTS) placement?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsString() linkUrl?: string;
  @IsOptional() @IsString() bannerLabel?: string;
  @IsOptional() @IsIn(MEDIA) mediaType?: string;
  @IsOptional() @IsInt() widthPx?: number;
  @IsOptional() @IsInt() heightPx?: number;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsInt() @Min(2) @Max(60) durationSeconds?: number;
}
