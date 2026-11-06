import { ApiProperty } from '@nestjs/swagger';
import { CategoryResponseDto } from '../../categories/dto/category.dto.js';
import { PaginationMetaDto } from '../../common/dto/pagination.dto.js';
import { TicketPriority, TicketStatus } from '../../generated/prisma/enums.js';

export class TicketPersonDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id: string;

  @ApiProperty({ type: String })
  name: string;
}

export class TicketClientDto extends TicketPersonDto {
  @ApiProperty({ type: String })
  email: string;
}

export class TicketResponseDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id: string;

  @ApiProperty({
    type: Number,
    description: 'Sequential number shown as #<number>',
  })
  number: number;

  @ApiProperty({ type: String })
  title: string;

  @ApiProperty({ type: String })
  description: string;

  @ApiProperty({ enum: TicketStatus, enumName: 'TicketStatus' })
  status: TicketStatus;

  @ApiProperty({ enum: TicketPriority, enumName: 'TicketPriority' })
  priority: TicketPriority;

  @ApiProperty({ type: TicketClientDto })
  client: TicketClientDto;

  @ApiProperty({ type: TicketPersonDto, nullable: true })
  technician: TicketPersonDto | null;

  @ApiProperty({ type: CategoryResponseDto })
  category: CategoryResponseDto;

  @ApiProperty({ type: Date, nullable: true })
  resolvedAt: Date | null;

  @ApiProperty({ type: Date })
  createdAt: Date;

  @ApiProperty({ type: Date })
  updatedAt: Date;
}

export class TicketListResponseDto {
  @ApiProperty({ type: [TicketResponseDto] })
  data: TicketResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}
