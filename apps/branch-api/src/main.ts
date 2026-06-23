import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

// Binds to 127.0.0.1 by default — never 0.0.0.0 — per docs/11-security-design.md §4:
// for the single-device desktop deployment the Branch API must not be reachable from
// the local network. A shared multi-tenant SaaS deployment must explicitly set
// BRANCH_API_HOST (e.g. "0.0.0.0") to serve more than one device/company; that is an
// ops/deployment decision, not a code default, so it stays loopback-only here.
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // The renderer calls this API cross-origin: Vite dev server (http://localhost:5173)
  // or a packaged Electron window (file://) vs. this API on 127.0.0.1. Reflecting the
  // request origin is safe for the default loopback-only bind; a shared deployment
  // that sets BRANCH_API_HOST must also set CORS_ORIGIN to a specific allow-list.
  const corsOrigin = process.env.CORS_ORIGIN;
  app.enableCors({ origin: corsOrigin ? corsOrigin.split(',') : true, credentials: true });

  const port = Number(process.env.BRANCH_API_PORT ?? 4000);
  const host = process.env.BRANCH_API_HOST ?? '127.0.0.1';
  await app.listen(port, host);
  // eslint-disable-next-line no-console
  console.log(`branch-api listening on http://${host}:${port}`);
}

bootstrap();
