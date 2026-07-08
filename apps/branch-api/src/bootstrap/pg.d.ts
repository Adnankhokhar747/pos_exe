// The `pg` package ships no type declarations of its own and `@types/pg` isn't
// vendored in this workspace, so this covers only the tiny surface this
// bootstrap module actually uses (see embedded-postgres.d.ts in apps/desktop
// for the same pattern applied to another untyped dependency).
declare module 'pg' {
  export class Client {
    constructor(config: { connectionString: string });
    connect(): Promise<void>;
    query(queryText: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
    end(): Promise<void>;
  }
}
