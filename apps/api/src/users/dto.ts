import { IsIn, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ASSIGNABLE_ROLES } from '../common/roles';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  username!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsIn([...ASSIGNABLE_ROLES])
  role!: string;
}

export class UpdateUserDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsIn([...ASSIGNABLE_ROLES])
  role!: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(8)
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}
