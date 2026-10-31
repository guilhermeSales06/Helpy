import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { trim } from '../../common/dto/transforms.js';

export class AreaInputDto {
  @ApiProperty({ type: String, maxLength: 80 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;
}

export class AreaResponseDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id: string;

  @ApiProperty({ type: String })
  name: string;
}
