import type { CliResult } from './helpers';

/** What `generate --json` prints. */
export interface Report {
  readonly dryRun: boolean;
  readonly created: string[];
  readonly updated: string[];
  readonly skipped: string[];
  readonly next: string[];
  readonly todos: { file: string; line: number; text: string }[];
  readonly notes: string[];
}

export function report(result: CliResult): Report {
  return result.json() as Report;
}

/** What a refused command prints with `--json`. */
export function failure(result: CliResult): { message: string; fix: string } {
  return (result.json() as { error: { message: string; fix: string } }).error;
}
