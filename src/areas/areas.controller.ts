import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import { AreasService } from './areas.service.js';
import { AreaInputDto, AreaResponseDto } from './dto/area.dto.js';

@ApiTags('areas')
@ApiUnauthorizedResponse()
@Controller('areas')
export class AreasController {
  constructor(private readonly areas: AreasService) {}

  @Post()
  @Roles(Role.ADMIN)
  @ApiCreatedResponse({ type: AreaResponseDto })
  @ApiForbiddenResponse({ description: 'Requires the ADMIN role' })
  @ApiConflictResponse({ description: 'Name already in use' })
  create(@Body() dto: AreaInputDto) {
    return this.areas.create(dto);
  }

  @Get()
  @ApiOkResponse({ type: [AreaResponseDto] })
  findAll() {
    return this.areas.findAll();
  }

  @Get(':id')
  @ApiOkResponse({ type: AreaResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.areas.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOkResponse({ type: AreaResponseDto })
  @ApiForbiddenResponse({ description: 'Requires the ADMIN role' })
  @ApiConflictResponse({ description: 'Name already in use' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AreaInputDto) {
    return this.areas.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiForbiddenResponse({ description: 'Requires the ADMIN role' })
  @ApiConflictResponse({ description: 'Area still has categories' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.areas.remove(id);
  }
}
