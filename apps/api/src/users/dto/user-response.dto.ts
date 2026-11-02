import { ApiProperty } from '@nestjs/swagger';
import { AreaResponseDto } from '../../areas/dto/area.dto.js';
import { PaginationMetaDto } from '../../common/dto/pagination.dto.js';
import { Role } from '../../generated/prisma/enums.js';

export class UserResponseDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id: string;

  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: String, format: 'email' })
  email: string;

  @ApiProperty({ enum: Role, enumName: 'Role' })
  role: Role;

  @ApiProperty({ type: String, nullable: true })
  phone: string | null;

  @ApiProperty({ type: String, nullable: true })
  specialty: string | null;

  @ApiProperty({
    type: [AreaResponseDto],
    description: 'Empty for anyone but technicians',
  })
  areas: AreaResponseDto[];

  @ApiProperty({ type: Boolean })
  active: boolean;

  @ApiProperty({ type: Date })
  createdAt: Date;

  @ApiProperty({ type: Date })
  updatedAt: Date;
}

export class UserListResponseDto {
  @ApiProperty({ type: [UserResponseDto] })
  data: UserResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}
