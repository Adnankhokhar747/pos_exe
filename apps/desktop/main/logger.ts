import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

// A packaged, double-clicked .exe has no console attached — Windows GUI-subsystem
// apps get closed/invalid stdout+stderr handles, so every console.log/console.error
// in this app (main process AND anything a spawned child process inherits stdio
// from) was silently going nowhere for a real user. This is the only way
// diagnostic info from a failed launch ever reaches anyone: written to a real
// file the user can find and paste into a support message.
let logFilePath: string | undefined;

function ensureLogFile(): string {
  if (!logFilePath) {
    const dir = path.join(app.getPath('appData'), 'VantagePOS', 'logs');
    fs.mkdirSync(dir, { recursive: true });
    logFilePath = path.join(dir, 'main.log');
  }
  return logFilePath;
}

export function getLogFilePath(): string {
  return ensureLogFile();
}

export function log(line: string): void {
  // eslint-disable-next-line no-console
  console.log(line);
  try {
    fs.appendFileSync(ensureLogFile(), `[${new Date().toISOString()}] ${line}\n`);
  } catch {
    // Nowhere left to report a logging failure to.
  }
}

export function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? `${error.name}: ${error.message}`;
  }
  if (error === undefined || error === null) {
    return `(rejected with no error value — ${String(error)})`;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
