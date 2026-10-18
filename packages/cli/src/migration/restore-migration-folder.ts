import fs from 'node:fs';
import path from 'node:path';
import { migrationFiles } from './migration-files.js';
import type { ReplayPlan } from './replay-plan.js';

/** Puts the migrations folder and its `meta/` back as the replay found them: what it wrote is deleted, what it deleted written again. */
export function restoreMigrationFolder({ root, folder, found }: ReplayPlan): void {
  for (const file of migrationFiles(root, folder).keys()) {
    if (!found.has(file)) {
      fs.rmSync(path.join(root, file));
    }
  }

  for (const [file, content] of found) {
    fs.writeFileSync(path.join(root, file), content);
  }
}
