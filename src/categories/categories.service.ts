import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  isForeignKeyViolation,
  isUniqueViolation,
} from '../common/prisma-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CreateCategoryDto,
  ListCategoriesQueryDto,
  UpdateCategoryDto,
} from './dto/category.dto.js';

const categorySelect = {
  id: true,
  name: true,
  area: { select: { id: true, name: true } },
};

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateCategoryDto) {
    return this.translateWriteErrors(
      this.prisma.category.create({ data, select: categorySelect }),
    );
  }

  findAll({ areaId }: ListCategoriesQueryDto) {
    return this.prisma.category.findMany({
      where: { areaId },
      select: categorySelect,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      select: categorySelect,
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async update(id: string, data: UpdateCategoryDto) {
    await this.findOne(id);
    return this.translateWriteErrors(
      this.prisma.category.update({
        where: { id },
        data,
        select: categorySelect,
      }),
    );
  }

  async remove(id: string) {
    await this.findOne(id);
    try {
      await this.prisma.category.delete({ where: { id } });
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new ConflictException('Category still has tickets');
      }
      throw error;
    }
  }

  private async translateWriteErrors<T>(query: Promise<T>) {
    try {
      return await query;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Category already exists in this area');
      }
      if (isForeignKeyViolation(error)) {
        throw new BadRequestException('Area not found');
      }
      throw error;
    }
  }
}
