import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '@/app.module';
import { buildOpenApiDocument } from '@/utilities';

/**
 * Emits a static `openapi.json` next to the backend root.
 *
 * Runs in Nest "preview" mode, which wires up the module/route metadata Swagger
 * needs without instantiating providers — so no database connection is required
 * just to export the spec.
 */
async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    preview: true,
    logger: false,
  });
  const document = buildOpenApiDocument(app);
  const outPath = join(__dirname, '..', 'openapi.json');
  writeFileSync(outPath, JSON.stringify(document, null, 2));
  await app.close();

  console.log(`OpenAPI spec written to ${outPath}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
