import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { hashPassword } from '../auth/password.js';
import { paginationMeta } from '../common/dto/pagination.dto.js';
import { isUniqueViolation } from '../common/prisma-errors.js';
import { Prisma } from '../generated/prisma/client.js';
import { Role } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CreateUserDto,
  ListUsersQueryDto,
  UpdateUserDto,
} from './dto/user-input.dto.js';
import { toUserResponse, userSelect } from './users.mapper.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create({ password, specialty, areaIds, ...data }: CreateUserDto) {
    await this.assertTechnicianFields(data.role, specialty, areaIds);

    const user = await this.rejectDuplicateEmail(
      this.prisma.user.create({
        data: {
          ...data,
          passwordHash: await hashPassword(password),
          technicianProfile:
            data.role === Role.TECHNICIAN
              ? {
                  create: {
                    specialty,
                    areas: { connect: areaIds?.map((id) => ({ id })) },
                  },
                }
              : undefined,
        },
        select: userSelect,
      }),
    );
    return toUserResponse(user);
  }

  async findAll({ role, active, ...pagination }: ListUsersQueryDto) {
    const where = { role, active } satisfies Prisma.UserWhereInput;
    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: userSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      data: users.map(toUserResponse),
      meta: paginationMeta(pagination, total),
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });
    if (!user) throw new NotFoundException('User not found');
    return toUserResponse(user);
  }

  async update(
    id: string,
    { password, specialty, areaIds, ...data }: UpdateUserDto,
  ) {
    const { role } = await this.findOne(id);
    await this.assertTechnicianFields(role, specialty, areaIds);
    const passwordHash = password ? await hashPassword(password) : undefined;

    const user = await this.rejectDuplicateEmail(
      this.prisma.$transaction(async (tx) => {
        // A new password ends existing sessions, in case the old one leaked.
        if (passwordHash) {
          await tx.refreshToken.updateMany({
            where: { userId: id, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }
        return tx.user.update({
          where: { id },
          data: {
            ...data,
            passwordHash,
            technicianProfile:
              specialty !== undefined || areaIds !== undefined
                ? {
                    upsert: {
                      create: {
                        specialty,
                        areas: { connect: areaIds?.map((id) => ({ id })) },
                      },
                      update: {
                        specialty,
                        areas: areaIds && {
                          set: areaIds.map((id) => ({ id })),
                        },
                      },
                    },
                  }
                : undefined,
          },
          select: userSelect,
        });
      }),
    );
    return toUserResponse(user);
  }

  async setActive(id: string, active: boolean, actorId: string) {
    if (id === actorId && !active) {
      throw new BadRequestException('You cannot deactivate your own account');
    }
    await this.findOne(id);

    const user = await this.prisma.$transaction(async (tx) => {
      if (!active) {
        await tx.refreshToken.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      return tx.user.update({
        where: { id },
        data: { active },
        select: userSelect,
      });
    });
    return toUserResponse(user);
  }

  private async assertTechnicianFields(
    role: Role,
    specialty?: string,
    areaIds?: string[],
  ) {
    if (specialty === undefined && areaIds === undefined) return;
    if (role !== Role.TECHNICIAN) {
      throw new BadRequestException(
        'Only technicians can have a specialty or areas',
      );
    }
    if (!areaIds?.length) return;

    const found = await this.prisma.area.count({
      where: { id: { in: areaIds } },
    });
    if (found !== areaIds.length) {
      throw new BadRequestException('Area not found');
    }
  }

  private async rejectDuplicateEmail<T>(query: Promise<T>) {
    try {
      return await query;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Email already in use');
      }
      throw error;
    }
  }
}
