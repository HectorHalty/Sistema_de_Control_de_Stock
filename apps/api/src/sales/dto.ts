import { IsString, IsOptional, IsInt, IsNumber, Min, IsArray, ValidateNested, IsUUID, IsBoolean, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class CheckoutItemDto {
  @IsUUID()
  salesProductId: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class CheckoutDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemDto)
  items: CheckoutItemDto[];

  /** Ignorado en el servidor: se usa el usuario del JWT. Opcional para no fallar validación en el cliente. */
  @IsOptional()
  @IsUUID()
  operatorId?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

export class ReturnDto {
  @IsUUID()
  ticketId: string;

  @IsOptional()
  @IsUUID()
  operatorId?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

/** Devolución parcial por productos (sin ticket origen). */
export class ReturnItemsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemDto)
  items: CheckoutItemDto[];

  @IsOptional()
  @IsUUID()
  operatorId?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

/** Reemplaza ítems de un ticket emitido (edición post-venta). */
export class UpdateTicketItemsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemDto)
  items: CheckoutItemDto[];

  @IsOptional()
  @IsUUID()
  operatorId?: string;
}

export class RecipeItemDto {
  @IsUUID()
  stockProductId: string;

  @IsNumber()
  @Min(0.001)
  quantity: number;
}

export class BundleItemDto {
  @IsUUID()
  componentProductId: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateSalesProductDto {
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
  @IsIn(['simple', 'promo'])
  kind?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipeItemDto)
  recipe?: RecipeItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BundleItemDto)
  bundle?: BundleItemDto[];
}

export class CreateKitchenDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  emoji?: string;
}

export class UpdateKitchenDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  emoji?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateSalesProductDto {
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
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsString()
  emoji?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsIn(['simple', 'promo'])
  kind?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipeItemDto)
  recipe?: RecipeItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BundleItemDto)
  bundle?: BundleItemDto[];
}
