import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  isForeignKeyViolation,
  isUniqueViolation,
} from '../common/prisma-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AreaInputDto } from './dto/area.dto.js';

const areaSelect = { id: true, name: true };

@Injectable()
export class AreasService {
  constructor(private readonly prisma: PrismaService) {}

  create(data: AreaInputDto) {
    return this.rejectDuplicateName(
      this.prisma.area.create({ data, select: areaSelect }),
    );
  }

  findAll() {
    return this.prisma.area.findMany({
      select: areaSelect,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const area = await this.prisma.area.findUnique({
      where: { id },
      select: areaSelect,
    });
    if (!area) throw new NotFoundException('Area not found');
    return area;
  }

  async update(id: string, data: AreaInputDto) {
    await this.findOne(id);
    return this.rejectDuplicateName(
      this.prisma.area.update({ where: { id }, data, select: areaSelect }),
    );
  }

  async remove(id: string) {
    await this.findOne(id);
    try {
      await this.prisma.area.delete({ where: { id } });
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new ConflictException('Area still has categories');
      }
      throw error;
    }
  }

  private async rejectDuplicateName<T>(query: Promise<T>) {
    try {
      return await query;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Area name already in use');
      }
      throw error;
    }
  }
}
