// Fixed on purpose: every e2e test wipes the tables, so these must never come
// from .env, which could point at the development or production database.
export const TEST_DATABASE_URL =
  'postgresql://helpy:helpy@localhost:5433/helpy_test';

export const TEST_JWT_SECRET = 'e2e-test-secret';

export const TEST_CORS_ORIGIN = 'http://front.test';
