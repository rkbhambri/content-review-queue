import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from '@/app.module';
import {
  ErrorResponseFilter,
  SuccessResponseInterceptor,
  buildOpenApiDocument,
  setupSwagger,
} from '@/utilities';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new SuccessResponseInterceptor(app.get(Reflector)));
  app.useGlobalFilters(new ErrorResponseFilter());
  app.enableShutdownHooks();

  setupSwagger(app, buildOpenApiDocument(app));

  const port = config.get<number>('port', 3000);
  await app.listen(port, '0.0.0.0');
  Logger.log(
    `API listening on http://localhost:${port}/api (docs: /api/docs)`,
    'Bootstrap',
  );
}

void bootstrap();
