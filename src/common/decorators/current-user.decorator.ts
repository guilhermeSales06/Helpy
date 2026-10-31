import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { Role } from '../../generated/prisma/enums.js';

export interface AuthUser {
  id: string;
  role: Role;
}

export type AuthenticatedRequest = Request & { user: AuthUser };

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
