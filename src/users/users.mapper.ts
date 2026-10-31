import { Prisma } from '../generated/prisma/client.js';
import { UserResponseDto } from './dto/user-response.dto.js';

// An explicit select keeps passwordHash out of every query that isn't login.
export const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  phone: true,
  active: true,
  createdAt: true,
  updatedAt: true,
  technicianProfile: { select: { specialty: true } },
} satisfies Prisma.UserSelect;

type SelectedUser = Prisma.UserGetPayload<{ select: typeof userSelect }>;

export function toUserResponse(user: SelectedUser): UserResponseDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    specialty: user.technicianProfile?.specialty ?? null,
    active: user.active,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
