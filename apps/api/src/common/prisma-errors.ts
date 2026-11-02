import { Prisma } from '../generated/prisma/client.js';

const hasCode = (error: unknown, code: string) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;

export const isUniqueViolation = (error: unknown) => hasCode(error, 'P2002');

export const isForeignKeyViolation = (error: unknown) =>
  hasCode(error, 'P2003');
