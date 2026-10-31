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
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
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
  CreateUserDto,
  ListUsersQueryDto,
  SetUserActiveDto,
  UpdateUserDto,
} from './dto/user-input.dto.js';
import {
  UserListResponseDto,
  UserResponseDto,
} from './dto/user-response.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('users')
@ApiUnauthorizedResponse()
@ApiForbiddenResponse({ description: 'Requires the ADMIN role' })
@Roles(Role.ADMIN)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Post()
  @ApiCreatedResponse({ type: UserResponseDto })
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Get()
  @ApiOkResponse({ type: UserListResponseDto })
  findAll(@Query() query: ListUsersQueryDto) {
    return this.users.findAll(query);
  }

  @Get(':id')
  @ApiOkResponse({ type: UserResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.findOne(id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: UserResponseDto })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    return this.users.update(id, dto);
  }

  @Patch(':id/active')
  @ApiOkResponse({ type: UserResponseDto })
  setActive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() { active }: SetUserActiveDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.users.setActive(id, active, actor.id);
  }
}
