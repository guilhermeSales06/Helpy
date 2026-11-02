import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { hashPassword } from '../src/auth/password.js';
import { Role } from '../src/generated/prisma/enums.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { setupApp } from '../src/setup-app.js';

export const PASSWORD = 'correct-horse-battery';

export async function createTestApp() {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  setupApp(app);
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}

export function resetDatabase(prisma: PrismaService) {
  return prisma.$executeRaw`TRUNCATE "User", "Area" CASCADE`;
}

export async function createTechnician(
  prisma: PrismaService,
  email: string,
  areaIds: string[] = [],
) {
  return prisma.user.create({
    data: {
      name: `Test technician ${email}`,
      email,
      passwordHash: await hashPassword(PASSWORD),
      role: Role.TECHNICIAN,
      technicianProfile: {
        create: { areas: { connect: areaIds.map((id) => ({ id })) } },
      },
    },
  });
}

export async function createCategory(
  prisma: PrismaService,
  areaName: string,
  categoryName = `${areaName} category`,
) {
  return prisma.category.create({
    data: {
      name: categoryName,
      area: {
        connectOrCreate: {
          where: { name: areaName },
          create: { name: areaName },
        },
      },
    },
  });
}

export async function createUser(
  prisma: PrismaService,
  role: Role,
  overrides: { email?: string; active?: boolean } = {},
) {
  return prisma.user.create({
    data: {
      name: `Test ${role}`,
      email: overrides.email ?? `${role.toLowerCase()}@test.local`,
      passwordHash: await hashPassword(PASSWORD),
      role,
      active: overrides.active ?? true,
    },
  });
}

export function refreshCookie(response: request.Response) {
  const cookies = response.get('Set-Cookie') ?? [];
  const cookie = cookies.find((value) => value.startsWith('refresh_token='));
  if (!cookie) throw new Error('Response did not set the refresh cookie');
  return cookie;
}

/** Keeps only the name=value pair, which is what a browser sends back. */
export const cookiePair = (cookie: string) => cookie.split(';')[0];

export async function login(
  app: INestApplication,
  email: string,
  password = PASSWORD,
) {
  const response = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email, password })
    .expect(200);

  return {
    accessToken: response.body.accessToken as string,
    cookie: cookiePair(refreshCookie(response)),
    response,
  };
}
