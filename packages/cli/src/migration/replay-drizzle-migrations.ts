import fs from 'node:fs';
import path from 'node:path';
import { CliError } from '../cli-error';
import type { Io } from '../commands/io';
import { WORKER_SCOPE_FILE } from '../commit/worker-scope-file';
import type { BranchMigration } from './branch-migration';
import { deleteBranchMigrations } from './delete-branch-migrations';
import { generateAndRead } from './generate-and-read';
import { migrationFiles } from './migration-files';
import { planReplay } from './plan-replay';
import { renameBranchMigrations } from './rename-branch-migrations';
import type { ReplayPlan } from './replay-plan';
import { replayedName } from './replayed-name';
import { restoreMigrationFolder } from './restore-migration-folder';
import { sqlStatements } from './sql-statements';
import { tidyWrittenMigration } from './tidy-written-migration';
import { waitForNextSecond } from './wait-for-next-second';

export interface DrizzleReplay {
  readonly root: string;
  /** The trunk the branch merged: its migrations are kept, the others generated again on top. */
  readonly base: string;
  readonly interactive: boolean;
  /**
   * The replay that lands the branch (`merge-trunk --to-land`): its migrations get their real
   * names even in the worktree of a worker, which otherwise keeps them working ones.
   */
  readonly final?: boolean;
}

/**
 * `drizzle-generate --replay`, after merging the trunk into a branch when both added migrations:
 * when the history forks from the base, deletes the migrations of the branch the base does not
 * have (with their snapshots and journal entries), then generates them again on top of the base,
 * one per deleted one, in their order and under their names. A custom migration gets its
 * statements back; a generated one that drizzle-kit now writes otherwise (edited by hand, or a
 * change of the base on what it changes) is refused and the folder put back. Migrations that
 * already follow the base are only renamed, when their name changes.
 */
export function replayDrizzleMigrations(replay: DrizzleReplay, io: Io): number {
  const plan = planReplay(replay);

  if (plan.migrations.length === 0) {
    io.out(`No migration of this branch is missing from ${plan.base}: nothing to replay.`);

    return 0;
  }

  const keepWorking = replay.final !== true && fs.existsSync(path.join(replay.root, WORKER_SCOPE_FILE));

  if (!plan.forked) {
    return renameInPlace(plan, keepWorking, io);
  }

  deleteBranchMigrations(plan);

  io.out(
    `Deleted, with their snapshots and journal entries: ${plan.migrations.map((migration) => migration.tag).join(', ')}.`,
  );

  const written = new Set<string>();
  let since = 0;

  for (const migration of plan.migrations) {
    waitForNextSecond(since);

    const code = generateAgain({ plan, migration, name: replayedName(migration.tag, keepWorking) }, replay, io);

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

/** The migrations of the branch follow the last one of the base already: drizzle-kit would write the same statements again. */
function renameInPlace(plan: ReplayPlan, keepWorking: boolean, io: Io): number {
  const renamed = renameBranchMigrations(plan, keepWorking);

  if (renamed.length === 0) {
    io.out(`The migrations of this branch follow the last one of ${plan.base}: nothing to replay.`);

    return 0;
  }

  for (const { from, to } of renamed) {
    io.out(`Renamed ${from} to ${to}: it follows the last migration of ${plan.base}, nothing to generate again.`);
  }

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
  } else {
    refuseChangedStatements({ plan, migration, name }, written.files.get(sql) ?? '');
  }

  io.out(`Generated ${path.posix.basename(sql, '.sql')} in place of ${migration.tag}.`);

  return written.paths;
}

/**
 * drizzle-kit writes the same statements for a change whichever schema it follows, unless the base
 * changed the same thing: a generated migration whose statements differ from what it writes now was
 * edited by hand, or needs a person. Generating it again would lose that, so the folder is put back.
 */
function refuseChangedStatements({ plan, migration, name }: Regeneration, generated: string): void {
  const branch = sqlStatements(migration.sql).map((statement) => statement.text);
  const now = sqlStatements(generated).map((statement) => statement.text);

  const at = Array.from({ length: Math.max(branch.length, now.length) }, (_, index) => index).find(
    (index) => branch[index] !== now[index],
  );

  if (at === undefined) {
    return;
  }

  restoreMigrationFolder(plan);

  throw new CliError(
    `${migration.tag} is not what drizzle-kit writes for its change on top of ${plan.base}: the branch has ${quoted(branch[at])}, drizzle-kit writes ${quoted(now[at])}. Its SQL was edited by hand, or ${plan.base} changed what it changes, and generating it again would lose that: ${plan.folder}/ is back as the replay found it.`,
    `Generate it yourself on top of ${plan.base}: delete the migrations of the branch ${plan.base} does not have (each .sql file, its snapshot under meta/ and its journal entry), run \`npm run db:generate ${name}\`, write the edits again (\`git show HEAD:${plan.folder}/${migration.tag}.sql\` holds them; \`--custom\` for a migration written by hand). The replay then finds nothing forked.`,
  );
}

function quoted(statement: string | undefined): string {
  return statement === undefined ? 'nothing more' : `\`${statement}\``;
}
