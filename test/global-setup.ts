import { execSync } from 'node:child_process';
import { TEST_DATABASE_URL } from './test-env.js';

export default function setup() {
  execSync('npx prisma migrate deploy', {
    stdio: 'pipe',
    env: {
      ...process.env,
      DATABASE_URL: TEST_DATABASE_URL,
      DIRECT_URL: TEST_DATABASE_URL,
    },
  });
}
