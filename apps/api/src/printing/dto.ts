import {
  IsString, IsOptional, IsInt, IsBoolean, IsNumber, Min, Max,
  IsArray, ValidateNested, IsIn, IsIP,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PrintItemDto {
  @IsString()
  name: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsOptional()
  @IsString()
  station?: string;
}

export class TestPrinterDto {
  @IsIP('4')
  ip: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  port: number;
}

export class PrintTicketDto {
  @IsIP('4')
  ip: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  port: number;

  @IsIn([58, 80])
  paperWidth: 58 | 80;

  @IsInt()
  ticketNumber: number;

  @IsString()
  createdAt: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrintItemDto)
  items: PrintItemDto[];

  @IsNumber()
  total: number;

  @IsOptional()
  @IsString()
  header?: string;

  @IsOptional()
  @IsString()
  subheader?: string;

  @IsOptional()
  @IsString()
  footer?: string;

  @IsOptional()
  @IsString()
  operatorName?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsIn(['venta', 'devolucion'])
  kind?: 'venta' | 'devolucion';

  @IsOptional()
  @IsBoolean()
  showDate?: boolean;

  @IsOptional()
  @IsBoolean()
  showOperator?: boolean;

  @IsOptional()
  @IsBoolean()
  showItemDetails?: boolean;

  @IsOptional()
  @IsBoolean()
  showLogo?: boolean;
}
