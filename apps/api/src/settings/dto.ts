import { Allow, IsString, IsOptional, IsInt, IsBoolean, IsIn, IsArray, MaxLength, Min, Max } from 'class-validator';

export class UpsertConfigDto {
  @IsString()
  @MaxLength(120)
  key: string;

  @IsString()
  @MaxLength(40)
  scope: string;

  @Allow()
  value: unknown;

  /** Bloqueo optimista — ver stock/dto.ts UpdateProductDto.version. */
  @IsOptional()
  @IsInt()
  @Min(0)
  version?: number;
}

export class CreateSalesCategoryDto {
  @IsString()
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  emoji?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateSalesCategoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  emoji?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class CreatePrinterDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsString()
  @MaxLength(80)
  type: string;

  @IsString()
  @MaxLength(80)
  ip: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @IsOptional()
  @IsIn([58, 80])
  paperWidth?: 58 | 80;

  @IsOptional()
  @IsBoolean()
  connected?: boolean;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdatePrinterDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  ip?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @IsOptional()
  @IsIn([58, 80])
  paperWidth?: 58 | 80;

  @IsOptional()
  @IsBoolean()
  connected?: boolean;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class CreateTableDto {
  @IsString()
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsIn(['libre', 'ocupada'])
  status?: string;

  @IsOptional()
  @IsString()
  currentOrderId?: string | null;
}

export class UpdateTableDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsIn(['libre', 'ocupada'])
  status?: string;

  @IsOptional()
  @IsString()
  currentOrderId?: string | null;
}

export class TeamAccountItemDto {
  @IsString()
  productId: string;

  @IsString()
  name: string;

  @IsInt()
  qty: number;

  price: number;
}

export class CreateTeamAccountDto {
  @IsString()
  @MaxLength(120)
  team: string;

  @IsOptional()
  @IsArray()
  items?: unknown;

  @IsOptional()
  @IsIn(['abierta', 'cerrada'])
  status?: string;
}

export class UpdateTeamAccountDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  team?: string;

  @IsOptional()
  items?: unknown;

  @IsOptional()
  @IsIn(['abierta', 'cerrada'])
  status?: string;
}

export class CreateAuditDto {
  @IsString()
  @MaxLength(40)
  module: string;

  @IsString()
  @MaxLength(200)
  action: string;

  @IsString()
  @MaxLength(200)
  element: string;

  @IsOptional()
  @IsString()
  previousValue?: string;

  @IsOptional()
  @IsString()
  newValue?: string;

  @IsOptional()
  @IsString()
  userName?: string;
}
