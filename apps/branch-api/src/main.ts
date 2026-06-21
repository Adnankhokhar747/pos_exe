import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

// Binds to 127.0.0.1 only — never 0.0.0.0 — per docs/11-security-design.md §4:
// the Branch API must not be reachable from the local network.
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = Number(process.env.BRANCH_API_PORT ?? 4000);
  await app.listen(port, '127.0.0.1');
  // eslint-disable-next-line no-console
  console.log(`branch-api listening on http://127.0.0.1:${port}`);
}

bootstrap();
