import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class GoogleAuthDto {
  @IsString()
  @IsNotEmpty()
  idToken!: string;
}

/** Solo disponible en NODE_ENV=development cuando no hay Google Client ID */
export class DevAuthDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  googleId?: string;
}

export class CompleteDniDto {
  @IsString()
  @MinLength(7)
  dni!: string;
}

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsString()
  @IsNotEmpty()
  nombre!: string;

  @IsString()
  @MinLength(7)
  dni!: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class FollowTeamDto {
  @IsString()
  @IsNotEmpty()
  equipoInscripcionId!: string;
}

export class RosterPlayerDto {
  @IsString()
  @IsNotEmpty()
  nombre!: string;

  @IsString()
  @IsNotEmpty()
  apellido!: string;

  @IsString()
  @MinLength(7)
  dni!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  fechaNacimiento!: string;

  @IsOptional()
  numeroCamiseta?: number;

  @IsOptional()
  @IsString()
  rolPlantel?: string;
}
