import fs from 'node:fs';
import path from 'node:path';
import { runGit } from '../commit/run-git';
import type { SliceVerification } from './slice-verification';
import { VERIFICATION_FILE } from './verification-file';

/**
 * Keeps the last verification of a worker in its worktree, ignored by git: when it ran, at which
 * commit, for which row, whether it passed, the steps that failed and the paths it listed to
 * stage. What the conductor reads when the worker stops, written by the kit, never by the agent.
 */
export function recordVerification(root: string, verification: SliceVerification): void {
  const failed = [
    ...(verification.regenerate.ok ? [] : ['regenerate']),
    ...(verification.check.errorCount === 0 ? [] : ['check']),
    ...(verification.tests.ok ? [] : ['tests']),
  ];

  const record = {
    at: new Date().toISOString(),
    head: runGit(root, ['rev-parse', 'HEAD'])?.trim() ?? null,
    row: verification.row ?? null,
    ok: verification.ok,
    failed,
    toStage: verification.toStage,
  };

  const file = path.join(root, VERIFICATION_FILE);

  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);
}
