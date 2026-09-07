import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { TipoEventoPartido } from '@prisma/client';

export class UpdateInscriptionDto {
  @IsOptional()
  @IsString()
  abbr?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsInt()
  descuentoPuntosWO?: number;
}

export class UpdateCaptainDto {
  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  dni?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class UpdateMatchScheduleDto {
  @IsOptional()
  @IsUUID()
  canchaId?: string | null;

  @IsOptional()
  @IsString()
  horaInicio?: string | null;

  @IsOptional()
  @IsUUID()
  jornadaId?: string | null;

  @IsOptional()
  @IsBoolean()
  bloqueadoManual?: boolean;

  @IsOptional()
  @IsString()
  venue?: string | null;
}

export class MatchEventDto {
  @IsUUID()
  personaId: string;

  @IsEnum(TipoEventoPartido)
  tipo: TipoEventoPartido;

  @IsOptional()
  @IsInt()
  minuto?: number;
}

export class UpdateMatchScoreDto {
  @IsNumber()
  @Min(0)
  homeGoals: number;

  @IsNumber()
  @Min(0)
  awayGoals: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MatchEventDto)
  events?: MatchEventDto[];
}

export class UpdateSuspensionDto {
  @IsOptional()
  @IsInt()
  fechasRestantes?: number;

  @IsOptional()
  @IsBoolean()
  activa?: boolean;

  @IsOptional()
  @IsString()
  motivo?: string;
}

export class UpdateReglamentoArticuloDto {
  @IsOptional()
  @IsString()
  titulo?: string;

  @IsOptional()
  @IsString()
  contenido?: string;

  @IsOptional()
  @IsBoolean()
  aplicable?: boolean;
}
