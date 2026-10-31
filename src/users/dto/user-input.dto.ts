import {
  ApiProperty,
  ApiPropertyOptional,
  PartialType,
  OmitType,
} from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto.js';
import { toBoolean, trim } from '../../common/dto/transforms.js';
import { Role } from '../../generated/prisma/enums.js';

// Admins only come from the seed, so the API can't create or promote one.
export const MANAGEABLE_ROLES = [Role.CLIENT, Role.TECHNICIAN] as const;
export type ManageableRole = (typeof MANAGEABLE_ROLES)[number];

export class CreateUserDto {
  @ApiProperty({ type: String, maxLength: 120 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ApiProperty({ type: String, format: 'email' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email: string;

  @ApiProperty({ type: String, minLength: 8, maxLength: 128 })
  @IsString()
  @Length(8, 128)
  password: string;

  @ApiProperty({ enum: MANAGEABLE_ROLES, enumName: 'ManageableRole' })
  @IsIn(MANAGEABLE_ROLES)
  role: ManageableRole;

  @ApiPropertyOptional({ type: String, maxLength: 30 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({
    type: String,
    maxLength: 120,
    description: 'Technicians only',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  specialty?: string;

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description:
      'Technicians only. Replaces the current areas when updating a user.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  areaIds?: string[];
}

export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['role'] as const),
) {}

export class SetUserActiveDto {
  @ApiProperty({ type: Boolean })
  @IsBoolean()
  active: boolean;
}

export class ListUsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: Role, enumName: 'Role' })
  @IsOptional()
  @IsIn(Object.values(Role))
  role?: Role;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  active?: boolean;
}
