import { IsString, IsOptional, IsInt, IsNumber, IsEnum, Min, IsUUID, MaxLength } from 'class-validator';

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

  @IsInt()
  quantity: number; // positive = add, negative = remove
}
