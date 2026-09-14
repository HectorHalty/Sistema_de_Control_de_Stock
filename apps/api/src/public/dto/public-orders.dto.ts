import { IsArray, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class PublicOrderItemDto {
  @IsString()
  @IsNotEmpty()
  salesProductId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class PublicCheckoutDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PublicOrderItemDto)
  items!: PublicOrderItemDto[];

  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @IsOptional()
  @IsString()
  nota?: string;
}

export class RedeemQrDto {
  @IsString()
  @IsNotEmpty()
  token!: string;
}
