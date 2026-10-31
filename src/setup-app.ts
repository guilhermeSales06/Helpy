import { INestApplication } from '@nestjs/common';

// Shared by the local server, the e2e tests and the future Vercel entrypoint,
// so all three expose the same routes.
export function setupApp(app: INestApplication) {
  app.setGlobalPrefix('api/v1');
}
