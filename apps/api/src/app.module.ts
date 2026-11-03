import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AreasModule } from './areas/areas.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { TicketsModule } from './tickets/tickets.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // The default limit is never reached: only the routes that use the guard
    // with @Throttle() are limited. The env var is read per request on purpose.
    ThrottlerModule.forRoot({
      throttlers: [{ limit: 1_000_000, ttl: 60_000 }],
      skipIf: () => process.env.THROTTLE_DISABLED === 'true',
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    AreasModule,
    CategoriesModule,
    TicketsModule,
    HealthModule,
  ],
})
export class AppModule {}
