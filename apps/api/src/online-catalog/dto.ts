import { Allow, IsOptional, IsString, IsNumber, IsBoolean, IsArray, IsUUID } from 'class-validator';

export class CreateOnlineCatalogProductDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  price: number;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsArray()
  images?: string[];

  @IsString()
  category: string;

  @IsOptional()
  @Allow()
  attributes?: Record<string, unknown> | null;

  @IsOptional()
  @IsUUID()
  stockProductId?: string;
}

export class UpdateOnlineCatalogProductDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsArray()
  images?: string[];

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @Allow()
  attributes?: Record<string, unknown> | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsUUID()
  stockProductId?: string;
}
