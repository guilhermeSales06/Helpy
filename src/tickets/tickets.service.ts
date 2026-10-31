import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../common/decorators/current-user.decorator.js';
import { paginationMeta } from '../common/dto/pagination.dto.js';
import { isForeignKeyViolation } from '../common/prisma-errors.js';
import { Prisma } from '../generated/prisma/client.js';
import {
  Role,
  TicketEventType,
  TicketPriority,
  TicketStatus,
} from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CreateTicketDto,
  ListTicketsQueryDto,
} from './dto/ticket-input.dto.js';
import { checkTransition } from './ticket-status.js';

const person = { select: { id: true, name: true } };

const ticketSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  resolvedAt: true,
  createdAt: true,
  updatedAt: true,
  client: person,
  technician: person,
  category: {
    select: {
      id: true,
      name: true,
      area: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.TicketSelect;

type SelectedTicket = Prisma.TicketGetPayload<{ select: typeof ticketSelect }>;

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateTicketDto, clientId: string) {
    try {
      return await this.prisma.ticket.create({
        data: { ...data, clientId },
        select: ticketSelect,
      });
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new BadRequestException('Category not found');
      }
      throw error;
    }
  }

  async findAll(query: ListTicketsQueryDto, actor: AuthUser) {
    const { status, priority, categoryId, technicianId, unassigned } = query;

    const filters: Prisma.TicketWhereInput[] = [
      this.visibleTo(actor),
      { status, priority, categoryId, technicianId },
    ];
    if (unassigned !== undefined) {
      filters.push({ technicianId: unassigned ? null : { not: null } });
    }
    const where = { AND: filters };

    const [tickets, total] = await this.prisma.$transaction([
      this.prisma.ticket.findMany({
        where,
        select: ticketSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.ticket.count({ where }),
    ]);
    return { data: tickets, meta: paginationMeta(query, total) };
  }

  async findOne(id: string, actor: AuthUser) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { AND: [{ id }, this.visibleTo(actor)] },
      select: ticketSelect,
    });
    // Same answer whether it doesn't exist or isn't visible, so that nobody can
    // find out which ticket ids exist.
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  async assign(id: string, technicianId: string, actor: AuthUser) {
    const ticket = await this.findOne(id, actor);
    if (
      ticket.status === TicketStatus.RESOLVED ||
      ticket.status === TicketStatus.CLOSED
    ) {
      throw new ConflictException(
        `Cannot assign a ${ticket.status.toLowerCase()} ticket`,
      );
    }

    const technician = await this.prisma.user.findFirst({
      where: { id: technicianId, role: Role.TECHNICIAN, active: true },
      select: { id: true },
    });
    if (!technician) {
      throw new BadRequestException('Technician not found or inactive');
    }
    if (ticket.technician?.id === technicianId) return ticket;

    return this.applyChange(
      ticket,
      actor,
      { technicianId },
      {
        type: TicketEventType.ASSIGNED,
        from: ticket.technician?.id,
        to: technicianId,
      },
    );
  }

  async changeStatus(id: string, status: TicketStatus, actor: AuthUser) {
    const ticket = await this.findOne(id, actor);
    this.assertAssignedIfTechnician(ticket, actor);

    const check = checkTransition(ticket.status, status, actor.role);
    if (check === 'invalid') {
      throw new ConflictException(
        `Cannot go from ${ticket.status} to ${status}`,
      );
    }
    if (check === 'forbidden') {
      throw new ForbiddenException(
        `Your role cannot go from ${ticket.status} to ${status}`,
      );
    }
    if (status === TicketStatus.IN_PROGRESS && !ticket.technician) {
      throw new ConflictException('Assign a technician first');
    }

    return this.applyChange(
      ticket,
      actor,
      {
        status,
        // Reopening clears the date, so that metrics only count the final resolution.
        ...(status === TicketStatus.RESOLVED && { resolvedAt: new Date() }),
        ...(status === TicketStatus.IN_PROGRESS && { resolvedAt: null }),
      },
      {
        type: TicketEventType.STATUS_CHANGED,
        from: ticket.status,
        to: status,
      },
    );
  }

  async changePriority(id: string, priority: TicketPriority, actor: AuthUser) {
    const ticket = await this.findOne(id, actor);
    this.assertAssignedIfTechnician(ticket, actor);

    if (ticket.status === TicketStatus.CLOSED) {
      throw new ConflictException('Cannot change a closed ticket');
    }
    if (ticket.priority === priority) return ticket;

    return this.applyChange(
      ticket,
      actor,
      { priority },
      {
        type: TicketEventType.PRIORITY_CHANGED,
        from: ticket.priority,
        to: priority,
      },
    );
  }

  private visibleTo(actor: AuthUser): Prisma.TicketWhereInput {
    switch (actor.role) {
      case Role.ADMIN:
        return {};
      case Role.CLIENT:
        return { clientId: actor.id };
      case Role.TECHNICIAN:
        return {
          OR: [
            { technicianId: actor.id },
            {
              technicianId: null,
              category: {
                area: { technicians: { some: { userId: actor.id } } },
              },
            },
          ],
        };
    }
  }

  // Technicians can see their area's unassigned queue, but only change their own tickets.
  private assertAssignedIfTechnician(ticket: SelectedTicket, actor: AuthUser) {
    if (actor.role === Role.TECHNICIAN && ticket.technician?.id !== actor.id) {
      throw new ForbiddenException('This ticket is not assigned to you');
    }
  }

  // Only writes if the ticket is still as it was read, so that two simultaneous
  // requests can't both succeed based on the same state. The change and its
  // audit event are saved together or not at all.
  private async applyChange(
    ticket: SelectedTicket,
    actor: AuthUser,
    data: Prisma.TicketUncheckedUpdateManyInput,
    event: { type: TicketEventType; from?: string; to: string },
  ) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.ticket.updateMany({
        where: {
          id: ticket.id,
          status: ticket.status,
          priority: ticket.priority,
          technicianId: ticket.technician?.id ?? null,
        },
        data,
      });
      if (count !== 1) return null;

      await tx.ticketEvent.create({
        data: { ...event, ticketId: ticket.id, actorId: actor.id },
      });
      return tx.ticket.findUniqueOrThrow({
        where: { id: ticket.id },
        select: ticketSelect,
      });
    });
    if (!updated) {
      throw new ConflictException('Ticket was changed by another request');
    }
    return updated;
  }
}
