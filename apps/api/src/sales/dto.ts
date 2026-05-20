import { IsString, IsOptional, IsInt, IsNumber, Min, IsArray, ValidateNested, IsUUID } from 'class-validator';
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

  @IsUUID()
  operatorId: string;

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

  @IsUUID()
  operatorId: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
