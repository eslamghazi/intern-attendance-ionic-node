// Types for the migration runner, which is plain .mjs so the CLI can run it
// without a build step — `npm run migrate` has to work on a checkout that has
// never been compiled, and in the compose `migrate` service that runs before
// the API image's dist is ever loaded.
//
// The app imports the same module (see MigrationService), and this is what lets
// it do so with types.

/** The minimum of a node-postgres client this runner uses. */
export interface MigrationClient {
  query(text: string, values?: unknown[]): Promise<{ rows: Record<string, string>[] }>;
}

export interface ConnectOptions {
  url: string;
  ssl?: boolean;
  timeoutMs?: number;
  onNotice?: (message: string) => void;
}

export interface MigrationStatus {
  /** Every .sql file on disk, in order. */
  names: string[];
  applied: string[];
  pending: string[];
}

export interface ApplyHooks {
  onStart?: (name: string) => void;
  onDone?: (name: string) => void;
}

export function connect(options: ConnectOptions): Promise<MigrationClient & { end(): Promise<void> }>;
export function ensureLedger(client: MigrationClient): Promise<void>;
export function status(client: MigrationClient, dir: string): Promise<MigrationStatus>;
export function pending(client: MigrationClient, dir: string): Promise<string[]>;
export function applyPending(
  client: MigrationClient,
  dir: string,
  hooks?: ApplyHooks,
): Promise<string[]>;
export function migrationFiles(dir: string): { names: string[]; pathOf: (name: string) => string };
export function verifyChecksums(
  applied: { id: string; checksum: string }[],
  names: string[],
  pathOf: (name: string) => string,
): void;
export function lineOf(text: string, offset: number): number;
export function sha(text: string): string;
export class SqlFileError extends Error {
  file: string;
  statement: string;
  offset: number;
  cause: Error & { code?: string };
}
