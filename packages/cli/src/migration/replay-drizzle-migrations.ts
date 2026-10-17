import fs from 'node:fs';
import path from 'node:path';
import type { Io } from '../commands/io.js';
import { WORKER_SCOPE_FILE } from '../commit/worker-scope-file.js';
import type { BranchMigration } from './branch-migration.js';
import { deleteBranchMigrations } from './delete-branch-migrations.js';
import { generateAndRead } from './generate-and-read.js';
import { migrationFiles } from './migration-files.js';
import { planReplay } from './plan-replay.js';
import type { ReplayPlan } from './replay-plan.js';
import { replayedName } from './replayed-name.js';
import { tidyWrittenMigration } from './tidy-written-migration.js';
import { waitForNextSecond } from './wait-for-next-second.js';

export interface DrizzleReplay {
  readonly root: string;
  /** The trunk the branch merged: its migrations are kept, the others generated again on top. */
  readonly base: string;
  readonly interactive: boolean;
}

/**
 * `drizzle-generate --replay`, after merging the trunk into a branch when both added migrations:
 * deletes the migrations of the branch the base does not have (with their snapshots and journal
 * entries), then generates them again on top of the base, one per deleted one, in their order and
 * under their names. A custom migration gets its statements back.
 */
export function replayDrizzleMigrations(replay: DrizzleReplay, io: Io): number {
  const plan = planReplay(replay);

  if (plan.migrations.length === 0) {
    io.out(`No migration of this branch is missing from ${plan.base}: nothing to replay.`);

    return 0;
  }

  deleteBranchMigrations(plan);

  io.out(
    `Deleted, with their snapshots and journal entries: ${plan.migrations.map((migration) => migration.tag).join(', ')}.`,
  );

  const written = new Set<string>();
  const inWorker = fs.existsSync(path.join(replay.root, WORKER_SCOPE_FILE));
  let since = 0;

  for (const migration of plan.migrations) {
    waitForNextSecond(since);

    const code = generateAgain({ plan, migration, name: replayedName(migration.tag, inWorker) }, replay, io);

    if (typeof code === 'number') {
      return code;
    }

    for (const file of code) {
      written.add(file);
    }

    since = Date.now();
  }

  const files = migrationFiles(replay.root, plan.folder);

  tidyWrittenMigration({ root: replay.root, paths: [...written], files }, io);
  io.out(`Stage ${plan.folder}/, then run \`npm run check:arch\`.`);

  return 0;
}

interface Regeneration {
  readonly plan: ReplayPlan;
  readonly migration: BranchMigration;
  readonly name: string;
}

/** Generates one migration again: what it wrote, or the exit code of drizzle-kit when it failed. */
function generateAgain(
  { plan, migration, name }: Regeneration,
  replay: DrizzleReplay,
  io: Io,
): readonly string[] | number {
  const { root, interactive } = replay;
  const { code, written } = generateAndRead({ root, name, custom: migration.custom, interactive }, io);
  const sql = written.paths.find((file) => file.endsWith('.sql') && path.posix.dirname(file) === plan.folder);

  if (code !== 0) {
    io.err(
      `drizzle-kit failed on ${name}: the migrations generated above are written, the others stay deleted. Delete what this run generated, restore ${plan.folder}/ as the merge left it (\`git checkout HEAD -- ${plan.folder}\`), fix the cause above and run the replay again.`,
    );

    return code;
  }

  if (sql === undefined) {
    io.err(`Warning: drizzle-kit wrote nothing for ${migration.tag}: ${plan.base} already holds its change.`);

    return written.paths;
  }

  if (migration.custom) {
    fs.writeFileSync(path.join(root, sql), migration.sql);
  }

  io.out(`Generated ${path.posix.basename(sql, '.sql')} in place of ${migration.tag}.`);

  return written.paths;
}
