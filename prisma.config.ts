import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Migrations need a direct connection: the pooler used at runtime (DATABASE_URL)
// doesn't support them. `process.env` instead of `env()` so that `prisma generate`
// still works where no database is configured, such as a fresh clone or CI.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL },
});
