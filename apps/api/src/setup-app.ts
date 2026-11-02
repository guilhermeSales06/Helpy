import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';

// Vercel's function bundle leaves out the files of swagger-ui-dist, because they
// are only read at runtime, so /docs loads them from a CDN instead.
const SWAGGER_UI_CDN = 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.34.0';

// Shared by the local server, the e2e tests and the future Vercel entrypoint,
// so all three expose the same routes.
export function setupApp(app: INestApplication) {
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api/v1');
  app.use(cookieParser());
  app.enableCors({
    origin: (config.get<string>('CORS_ORIGINS') ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Helpy API')
      .setDescription(
        'Helpdesk API. Send the access token as a Bearer token. The refresh token travels in an httpOnly cookie, so the front end must call the auth routes with credentials enabled.',
      )
      .setVersion('2.0')
      .addBearerAuth()
      .addSecurityRequirements('bearer')
      .build(),
  );
  SwaggerModule.setup('docs', app, document, {
    customSiteTitle: 'Helpy API',
    customCssUrl: `${SWAGGER_UI_CDN}/swagger-ui.css`,
    customJs: [
      `${SWAGGER_UI_CDN}/swagger-ui-bundle.js`,
      `${SWAGGER_UI_CDN}/swagger-ui-standalone-preset.js`,
    ],
    customfavIcon: `${SWAGGER_UI_CDN}/favicon-32x32.png`,
  });
}
