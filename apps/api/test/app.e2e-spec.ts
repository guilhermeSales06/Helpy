import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './helpers.js';
import { TEST_CORS_ORIGIN } from './test-env.js';

// Requires the database from docker-compose.yml to be running.
describe('App (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('/api/v1/health (GET) is public', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  describe('database', () => {
    it('has row level security on every table', async () => {
      const tables = await app.get(PrismaService).$queryRaw<
        { tablename: string }[]
      >`SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename <> '_prisma_migrations'
          AND NOT rowsecurity`;

      expect(tables).toEqual([]);
    });
  });

  describe('docs', () => {
    it('serves Swagger UI with its assets from the CDN', async () => {
      const { text } = await request(app.getHttpServer())
        .get('/docs')
        .expect(200);

      expect(text).toContain('swagger-ui-dist@5.34.0/swagger-ui.css');
      expect(text).toContain('swagger-ui-dist@5.34.0/swagger-ui-bundle.js');
    });

    it('documents the routes without exposing the password hash', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/docs-json')
        .expect(200);

      expect(Object.keys(body.paths)).toEqual(
        expect.arrayContaining([
          '/api/v1/auth/login',
          '/api/v1/auth/refresh',
          '/api/v1/auth/logout',
          '/api/v1/auth/me',
          '/api/v1/users',
          '/api/v1/users/{id}',
          '/api/v1/users/{id}/active',
          '/api/v1/areas',
          '/api/v1/areas/{id}',
          '/api/v1/categories',
          '/api/v1/categories/{id}',
          '/api/v1/tickets',
          '/api/v1/tickets/{id}',
          '/api/v1/tickets/{id}/assign',
          '/api/v1/tickets/{id}/status',
          '/api/v1/tickets/{id}/priority',
        ]),
      );
      expect(JSON.stringify(body)).not.toContain('passwordHash');
    });
  });

  describe('CORS', () => {
    it('allows credentials from a configured origin', async () => {
      const response = await request(app.getHttpServer())
        .options('/api/v1/auth/login')
        .set('Origin', TEST_CORS_ORIGIN)
        .set('Access-Control-Request-Method', 'POST');

      expect(response.get('Access-Control-Allow-Origin')).toBe(
        TEST_CORS_ORIGIN,
      );
      expect(response.get('Access-Control-Allow-Credentials')).toBe('true');
    });

    it('does not allow other origins', async () => {
      const response = await request(app.getHttpServer())
        .options('/api/v1/auth/login')
        .set('Origin', 'http://evil.test')
        .set('Access-Control-Request-Method', 'POST');

      expect(response.get('Access-Control-Allow-Origin')).toBeUndefined();
    });
  });
});
