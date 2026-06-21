import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

// Binds to 127.0.0.1 only — never 0.0.0.0 — per docs/11-security-design.md §4:
// the Branch API must not be reachable from the local network.
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // The renderer calls this API cross-origin: Vite dev server (http://localhost:5173)
  // or a packaged Electron window (file://) vs. this API on 127.0.0.1. Reflecting the
  // request origin is safe here since the API only ever binds to 127.0.0.1 (see below)
  // and is never reachable from outside the device.
  app.enableCors({ origin: true, credentials: true });

  const port = Number(process.env.BRANCH_API_PORT ?? 4000);
  await app.listen(port, '127.0.0.1');
  // eslint-disable-next-line no-console
  console.log(`branch-api listening on http://127.0.0.1:${port}`);
}

bootstrap();
