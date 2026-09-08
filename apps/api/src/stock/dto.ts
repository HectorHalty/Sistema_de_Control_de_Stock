import { IsString, IsOptional, IsInt, IsNumber, IsEnum, Min, IsUUID, MaxLength, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { UnidadMedida } from '@prisma/client';

export class CreateProductDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsString()
  @MaxLength(100)
  code: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsUUID()
  categoryId: string;

  @IsOptional()
  @IsEnum(UnidadMedida)
  unit?: UnidadMedida;

  @IsOptional()
  @IsInt()
  orderUnit?: number;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  initialStock?: number;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsEnum(UnidadMedida)
  unit?: UnidadMedida;

  @IsOptional()
  @IsInt()
  orderUnit?: number | null;

  @IsOptional()
  @IsString()
  image?: string | null;

  /**
   * Bloqueo optimista: versión que el cliente tenía al cargar el producto.
   * Si no coincide con la actual, el update se rechaza con 409 en vez de
   * pisar silenciosamente la edición de otra persona. Opcional por ahora
   * para no romper llamadas existentes (scripts, tests) que todavía no la
   * mandan — sin ella, el update no chequea versión (comportamiento previo).
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  version?: number;
}

export class AdjustStockDto {
  @IsUUID()
  warehouseId: string;

  @IsNumber()
  quantity: number; // positive = add, negative = remove (admite fracciones: kg/litros)

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reference?: string;

  @IsOptional()
  @IsUUID()
  operatorId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  operatorName?: string;
}

export class StockCountEntryDto {
  @IsUUID()
  productId: string;

  @IsString()
  @MaxLength(200)
  productName: string;

  @IsEnum(UnidadMedida)
  unit: UnidadMedida;

  @IsNumber()
  expected: number;

  @IsNumber()
  counted: number;
}

export class CreateStockCountSessionDto {
  @IsString()
  @MaxLength(20)
  date: string;

  @IsOptional()
  @IsString()
  dateType?: 'regular' | 'after';

  @IsOptional()
  @IsUUID()
  operatorId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  operatorName?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StockCountEntryDto)
  entries: StockCountEntryDto[];
}

export class CreateSupplierDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  productIds?: string[];
}

export class UpdateSupplierDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  productIds?: string[];
}

export class PurchaseOrderItemDto {
  @IsUUID()
  productId: string;

  @IsNumber()
  @Min(0.001)
  quantityOrdered: number;
}

export class CreatePurchaseOrderDto {
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsString()
  @MaxLength(200)
  provider: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemDto)
  items: PurchaseOrderItemDto[];
}

export class UpdatePurchaseOrderDto {
  @IsOptional()
  @IsUUID()
  supplierId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  provider?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemDto)
  items?: PurchaseOrderItemDto[];

  /** Bloqueo optimista — ver UpdateProductDto.version. */
  @IsOptional()
  @IsInt()
  @Min(0)
  version?: number;
}

export class ReceiveAllocationDto {
  @IsUUID()
  warehouseId: string;

  @IsNumber()
  @Min(0)
  quantity: number;
}

export class ReceivePurchaseOrderItemDto {
  @IsUUID()
  productId: string;

  @IsNumber()
  @Min(0)
  quantityReceived: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceiveAllocationDto)
  allocations: ReceiveAllocationDto[];
}

export class ReceivePurchaseOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceivePurchaseOrderItemDto)
  items: ReceivePurchaseOrderItemDto[];

  @IsOptional()
  @IsUUID()
  operatorId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  operatorName?: string;
}

export class CreateCategoryDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  icon?: string;
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  icon?: string;
}

export class CreateWarehouseDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsString()
  @MaxLength(200)
  location: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  icon?: string;
}

export class UpdateWarehouseDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  icon?: string;
}
