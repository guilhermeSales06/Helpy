import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from '../src/auth/password.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { Role } from '../src/generated/prisma/enums.js';

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

const name = requireEnv('SEED_ADMIN_NAME');
const email = requireEnv('SEED_ADMIN_EMAIL').trim().toLowerCase();
const password = requireEnv('SEED_ADMIN_PASSWORD');
if (password.length < 8) {
  throw new Error('SEED_ADMIN_PASSWORD must have at least 8 characters');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DIRECT_URL ?? requireEnv('DATABASE_URL'),
  }),
});

try {
  // Running the seed again never overwrites an admin that already exists.
  const admin = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      name,
      email,
      passwordHash: await hashPassword(password),
      role: Role.ADMIN,
    },
  });
  console.log(`Admin ready: ${admin.email}`);
} finally {
  await prisma.$disconnect();
}
