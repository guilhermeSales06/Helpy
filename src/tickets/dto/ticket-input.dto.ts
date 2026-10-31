import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto.js';
import { toBoolean, trim } from '../../common/dto/transforms.js';
import { TicketPriority, TicketStatus } from '../../generated/prisma/enums.js';

const statuses = Object.values(TicketStatus);
const priorities = Object.values(TicketPriority);

export class CreateTicketDto {
  @ApiProperty({ type: String, maxLength: 150 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  title: string;

  @ApiProperty({ type: String, maxLength: 5000 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  description: string;

  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  categoryId: string;

  @ApiPropertyOptional({
    enum: TicketPriority,
    enumName: 'TicketPriority',
    default: TicketPriority.NORMAL,
  })
  @IsOptional()
  @IsIn(priorities)
  priority?: TicketPriority;
}

export class AssignTicketDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  technicianId: string;
}

export class UpdateTicketStatusDto {
  @ApiProperty({ enum: TicketStatus, enumName: 'TicketStatus' })
  @IsIn(statuses)
  status: TicketStatus;
}

export class UpdateTicketPriorityDto {
  @ApiProperty({ enum: TicketPriority, enumName: 'TicketPriority' })
  @IsIn(priorities)
  priority: TicketPriority;
}

export class ListTicketsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: TicketStatus, enumName: 'TicketStatus' })
  @IsOptional()
  @IsIn(statuses)
  status?: TicketStatus;

  @ApiPropertyOptional({ enum: TicketPriority, enumName: 'TicketPriority' })
  @IsOptional()
  @IsIn(priorities)
  priority?: TicketPriority;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  technicianId?: string;

  @ApiPropertyOptional({
    type: Boolean,
    description: 'Only tickets with (false) or without (true) a technician',
  })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  unassigned?: boolean;
}
