import fs from 'node:fs';
import path from 'node:path';
import { runGit } from '../commit/run-git';
import type { ReplayPlan } from './replay-plan';

/**
 * Deletes the migrations of the branch, their snapshots and their journal entries: the journal
 * becomes the one of the base, so that its last snapshot is the parent of what drizzle-kit
 * generates next. A file the base has under the same path (a snapshot numbered as one of the
 * base's, under `prefix: 'index'`) takes the content of the base instead of being deleted.
 */
export function deleteBranchMigrations({ root, base, folder, migrations }: ReplayPlan): void {
  const snapshots = migrations.map((migration) => `${folder}/meta/${migration.tag.split('_')[0] ?? ''}_snapshot.json`);
  const sqlFiles = migrations.map((migration) => `${folder}/${migration.tag}.sql`);

  for (const file of [...sqlFiles, ...snapshots, `${folder}/meta/_journal.json`]) {
    const onBase = runGit(root, ['show', `${base}:./${file}`]);

    if (onBase === undefined) {
      fs.rmSync(path.join(root, file), { force: true });
    } else {
      fs.writeFileSync(path.join(root, file), onBase);
    }
  }
}
