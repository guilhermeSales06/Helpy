import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { setupApp } from './setup-app.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  setupApp(app);
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}

// Must not be awaited at the top level. On Vercel, listen() never resolves, and
// requests only start after this module finishes loading, so it would hang.
void bootstrap();
