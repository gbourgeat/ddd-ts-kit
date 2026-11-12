import fs from 'node:fs';
import path from 'node:path';
import type { ReplayPlan } from './replay-plan';
import { snapshotMigrationFolder } from './snapshot-migration-folder';

/**
 * Puts the migrations folder and its `meta/` back as the replay found them: what it wrote is
 * deleted, what it deleted or changed is written again, byte for byte. A file it never touched
 * is left alone.
 */
export function restoreMigrationFolder({
  root,
  folder,
  snapshot,
}: Pick<ReplayPlan, 'root' | 'folder' | 'snapshot'>): void {
  const now = snapshotMigrationFolder(root, folder);

  for (const file of now.keys()) {
    if (!snapshot.has(file)) {
      fs.rmSync(path.join(root, file));
    }
  }

  for (const [file, content] of snapshot) {
    if (now.get(file)?.equals(content) !== true) {
      fs.writeFileSync(path.join(root, file), content);
    }
  }
}
