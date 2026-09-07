import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class OnlineRecipeItemDto {
  @IsUUID()
  stockProductId: string;

  @IsNumber()
  @Min(0.001)
  quantity: number;
}

export class CreateWebMenuProductDto {
  @IsString()
  name: string;

  @IsUUID()
  categoriaVentaId: string;

  @IsUUID()
  kitchenId: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsString()
  emoji?: string;

  @IsOptional()
  @IsString()
  descripcionWeb?: string;

  @IsOptional()
  @IsString()
  imagenWeb?: string;

  @IsOptional()
  @IsBoolean()
  visibleWeb?: boolean;

  @IsOptional()
  @IsUUID()
  webCategoryId?: string;

  @IsOptional()
  @IsBoolean()
  popularWeb?: boolean;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  filterIds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OnlineRecipeItemDto)
  recipe?: OnlineRecipeItemDto[];
}

export class UpdateWebMenuProductDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsUUID()
  categoriaVentaId?: string;

  @IsOptional()
  @IsUUID()
  kitchenId?: string;

  @IsOptional()
  @IsBoolean()
  visibleWeb?: boolean;

  @IsOptional()
  @IsString()
  descripcionWeb?: string | null;

  @IsOptional()
  @IsString()
  imagenWeb?: string | null;

  @IsOptional()
  @IsString()
  emoji?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsUUID()
  webCategoryId?: string | null;

  @IsOptional()
  @IsBoolean()
  popularWeb?: boolean;

  @IsOptional()
  @IsInt()
  webSortOrder?: number;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  filterIds?: string[];

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreateOnlineCategoryDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateOnlineCategoryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreateOnlineFilterDto {
  @IsString()
  label: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateOnlineFilterDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class RedeemQrDto {
  @IsString()
  token: string;
}
