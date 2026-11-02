import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import {
  TEST_CORS_ORIGIN,
  TEST_DATABASE_URL,
  TEST_JWT_SECRET,
} from './test/test-env.js';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    globalSetup: './test/global-setup.ts',
    // The test files share one database and wipe it between tests.
    fileParallelism: false,
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      DIRECT_URL: TEST_DATABASE_URL,
      JWT_ACCESS_SECRET: TEST_JWT_SECRET,
      CORS_ORIGINS: TEST_CORS_ORIGIN,
    },
  },
});
