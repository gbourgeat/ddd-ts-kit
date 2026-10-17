import { spawnSync } from 'node:child_process';
import type { Io } from '../commands/io.js';
import { findProjectFormatter } from './find-project-formatter.js';
import type { WrittenMigration } from './written-migration.js';

/** Enough of a failing formatter to read the cause. */
const TAIL_LINES = 20;

/**
 * Formats the snapshot and the journal drizzle-kit wrote under `meta/` as the project formats its
 * files, so that its format gate passes on them; the SQL is left as drizzle-kit wrote it. A
 * formatter that fails or is missing is reported: the migration is written either way.
 */
export function formatWrittenFiles({ root, paths }: WrittenMigration, io: Io): void {
  const json = paths.filter((file) => file.includes('/meta/') && file.endsWith('.json'));

  if (json.length === 0) {
    return;
  }

  const formatter = findProjectFormatter(root);

  if (typeof formatter === 'string') {
    io.out(`Not formatted (${formatter}): ${json.join(', ')}.`);

    return;
  }

  const run = spawnSync(process.execPath, [formatter.bin, ...formatter.args, ...json], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (run.status === 0) {
    io.out(`Formatted with ${formatter.name}, as the format script does: ${json.join(', ')}.`);

    return;
  }

  const printed = `${run.stdout}${run.stderr}`.trimEnd().split('\n').slice(-TAIL_LINES).join('\n');

  io.err(`Warning: ${formatter.name} failed on ${json.join(', ')}; format them before committing.\n${printed}`);
}
