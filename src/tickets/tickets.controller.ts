import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthUser,
} from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import {
  AssignTicketDto,
  CreateTicketDto,
  ListTicketsQueryDto,
  UpdateTicketPriorityDto,
  UpdateTicketStatusDto,
} from './dto/ticket-input.dto.js';
import {
  TicketListResponseDto,
  TicketResponseDto,
} from './dto/ticket-response.dto.js';
import { TicketsService } from './tickets.service.js';

@ApiTags('tickets')
@ApiUnauthorizedResponse()
@Controller('tickets')
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Post()
  @Roles(Role.CLIENT)
  @ApiOperation({ summary: 'Open a ticket (clients only)' })
  @ApiCreatedResponse({ type: TicketResponseDto })
  @ApiForbiddenResponse({ description: 'Requires the CLIENT role' })
  create(@Body() dto: CreateTicketDto, @CurrentUser() actor: AuthUser) {
    return this.tickets.create(dto, actor.id);
  }

  @Get()
  @ApiOperation({
    summary: 'List the tickets visible to the caller',
    description:
      'Clients see their own tickets. Technicians see their assigned tickets and the unassigned queue of their areas. Admins see everything.',
  })
  @ApiOkResponse({ type: TicketListResponseDto })
  findAll(@Query() query: ListTicketsQueryDto, @CurrentUser() actor: AuthUser) {
    return this.tickets.findAll(query, actor);
  }

  @Get(':id')
  @ApiOkResponse({ type: TicketResponseDto })
  @ApiNotFoundResponse({ description: 'Unknown or not visible to the caller' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.tickets.findOne(id, actor);
  }

  @Patch(':id/assign')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Assign or reassign a technician (admins only)' })
  @ApiOkResponse({ type: TicketResponseDto })
  @ApiForbiddenResponse({ description: 'Requires the ADMIN role' })
  @ApiNotFoundResponse()
  @ApiConflictResponse({ description: 'Ticket is resolved or closed' })
  assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() { technicianId }: AssignTicketDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.tickets.assign(id, technicianId, actor);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Move the ticket to another status',
    description:
      'OPEN → IN_PROGRESS and IN_PROGRESS → RESOLVED: assigned technician or admin. RESOLVED → CLOSED: client or admin. RESOLVED → IN_PROGRESS (reopen): client, assigned technician or admin.',
  })
  @ApiOkResponse({ type: TicketResponseDto })
  @ApiForbiddenResponse({ description: 'Not allowed for this role or ticket' })
  @ApiNotFoundResponse()
  @ApiConflictResponse({
    description: 'Invalid transition, or no technician assigned yet',
  })
  changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() { status }: UpdateTicketStatusDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.tickets.changeStatus(id, status, actor);
  }

  @Patch(':id/priority')
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  @ApiOperation({
    summary: 'Change the priority (admin or assigned technician)',
  })
  @ApiOkResponse({ type: TicketResponseDto })
  @ApiForbiddenResponse({ description: 'Not allowed for this role or ticket' })
  @ApiNotFoundResponse()
  @ApiConflictResponse({ description: 'Ticket is closed' })
  changePriority(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() { priority }: UpdateTicketPriorityDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.tickets.changePriority(id, priority, actor);
  }
}
