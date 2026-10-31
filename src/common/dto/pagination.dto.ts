import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationQueryDto {
  @ApiPropertyOptional({ type: Number, minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}

export class PaginationMetaDto {
  @ApiProperty({ type: Number })
  page: number;

  @ApiProperty({ type: Number })
  limit: number;

  @ApiProperty({ type: Number })
  total: number;

  @ApiProperty({ type: Number })
  totalPages: number;
}

export function paginationMeta(
  { page, limit }: PaginationQueryDto,
  total: number,
): PaginationMetaDto {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}
