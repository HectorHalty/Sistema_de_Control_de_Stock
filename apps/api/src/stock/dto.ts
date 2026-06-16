import { IsString, IsOptional, IsInt, IsNumber, IsEnum, Min, IsUUID, MaxLength, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

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
  @IsString()
  @MaxLength(50)
  unit?: string;

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
  description?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  unit?: string;

  @IsOptional()
  @IsInt()
  orderUnit?: number;

  @IsOptional()
  @IsString()
  image?: string;
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

export class CreateEmployeeConsumptionDto {
  @IsUUID()
  productId: string;

  @IsUUID()
  warehouseId: string;

  @IsNumber()
  @Min(0.001)
  quantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsUUID()
  operatorId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  operatorName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  operatorRole?: string;
}

export class StockCountEntryDto {
  @IsUUID()
  productId: string;

  @IsString()
  @MaxLength(200)
  productName: string;

  @IsString()
  @MaxLength(50)
  unit: string;

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
