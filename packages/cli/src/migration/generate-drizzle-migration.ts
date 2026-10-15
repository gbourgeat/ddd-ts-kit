import { spawnSync } from 'node:child_process';
import { CliError } from '../cli-error.js';
import type { Io } from '../commands/io.js';
import { drizzleKitBin } from './drizzle-kit-bin.js';
import { DRIZZLE_SILENT_FAILURES } from './drizzle-silent-failures.js';

export interface DrizzleMigration {
  readonly root: string;
  readonly name: string;
  readonly custom: boolean;
  /** True when a person can answer the questions of drizzle-kit: standard input and output are a terminal. */
  readonly interactive: boolean;
}

/**
 * Runs `drizzle-kit generate` for one named migration and answers its exit code. In a terminal it
 * is drizzle-kit as is. Without one, a failure after which drizzle-kit writes nothing and exits 0
 * (its question about a rename, a forked snapshot) becomes an error that names the fix.
 */
export function generateDrizzleMigration(migration: DrizzleMigration, io: Io): number {
  const { root, name, custom, interactive } = migration;
  const args = [drizzleKitBin(root), 'generate', '--name', name, ...(custom ? ['--custom'] : [])];

  const run = spawnSync(process.execPath, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: interactive ? 'inherit' : ['ignore', 'pipe', 'pipe'],
  });

  if (interactive) {
    return run.status ?? 1;
  }

  printOutput(run.stdout, run.stderr, io);

  const printed = `${run.stdout}${run.stderr}`;
  const failure = DRIZZLE_SILENT_FAILURES.find((known) => printed.includes(known.printed));

  if (failure !== undefined) {
    throw new CliError(failure.message, failure.fix);
  }

  return run.status ?? 1;
}

function printOutput(stdout: string, stderr: string, io: Io): void {
  if (stdout.trim() !== '') {
    io.out(stdout.trimEnd());
  }

  if (stderr.trim() !== '') {
    io.err(stderr.trimEnd());
  }
}
