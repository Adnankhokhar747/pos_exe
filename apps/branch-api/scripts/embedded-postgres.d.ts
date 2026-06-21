// Ambient typing for embedded-postgres, mirroring its real dist/index.d.ts /
// dist/types.d.ts. Needed because the package ships ESM-only ("type":
// "module", exports-only entry point) and TS's classic Node module
// resolution (used by this CommonJS project) can't see it otherwise.
declare module 'embedded-postgres' {
  interface PostgresOptions {
    databaseDir: string;
    port: number;
    user: string;
    password: string;
    persistent: boolean;
  }

  class EmbeddedPostgres {
    constructor(options?: Partial<PostgresOptions>);
    initialise(): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
    createDatabase(name: string): Promise<void>;
    dropDatabase(name: string): Promise<void>;
  }

  export default EmbeddedPostgres;
}
