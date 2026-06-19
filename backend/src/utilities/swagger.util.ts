import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

/** Single source of truth for the OpenAPI definition (UI + exported file). */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Content Review Queue API')
    .setDescription(
      'Locale-based content review queue. Reviewers authenticate with a locale, ' +
        'browse locale-scoped tickets, reserve one (held for the TTL), and confirm ' +
        'within the window before it auto-releases back to the queue.',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'bearer',
    )
    .addTag('auth', 'Reviewer authentication')
    .addTag('tickets', 'Browse, reserve, confirm, and stream tickets')
    .addTag('metrics', 'Queue health metrics')
    .addTag('health', 'Service liveness')
    .build();

  return SwaggerModule.createDocument(app, config);
}

/** Mounts interactive Swagger UI at `/api/docs`. */
export function setupSwagger(
  app: INestApplication,
  document: OpenAPIObject,
): void {
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });
}
