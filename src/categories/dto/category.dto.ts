import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { AreaResponseDto } from '../../areas/dto/area.dto.js';
import { trim } from '../../common/dto/transforms.js';

export class CreateCategoryDto {
  @ApiProperty({ type: String, maxLength: 80 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;

  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  areaId: string;
}

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}

export class ListCategoriesQueryDto {
  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  areaId?: string;
}

export class CategoryResponseDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id: string;

  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: AreaResponseDto })
  area: AreaResponseDto;
}
