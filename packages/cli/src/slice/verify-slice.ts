import fs from 'node:fs';
import path from 'node:path';
import { changedFiles } from '../check/commands/changed-files.js';
import { citedRemovals } from '../citations/cited-removals.js';
import { runCheck } from '../check/engine/run-check.js';
import { summarize } from '../check/engine/summarize.js';
import { loadProject } from '../check/project/load-project.js';
import { CliError } from '../cli-error.js';
import { isRecord } from '../config/values/is-record.js';
import { nearTheLimit } from './near-the-limit.js';
import { changedEntries } from './changed-entries.js';
import { planStaging } from './plan-staging.js';
import { runScript } from './run-script.js';
import type { SliceToVerify } from './slice-to-verify.js';
import type { SliceVerification } from './slice-verification.js';

/** The scripts a slice runs; `regenerate` arrived in 0.21. */
const SCRIPTS = ['regenerate', 'test'];

/**
 * The steps that close a slice before its commit, in one run: the derived files regenerated,
 * the architecture rules on the files changed since `since` (new ones included), the specs of
 * the context; then the changed files near the size limit and the paths to stage. Every step
 * runs, so that one answer tells everything that is left.
 */
export function verifySlice({ root, config, context, since }: SliceToVerify): SliceVerification {
  requireScripts(root);

  const manager = config.stack.packageManager;
  const regenerate = runScript({ root, manager, script: 'regenerate' });
  const changed = changedFiles(root, since);
  const project = loadProject(root);
  const run = runCheck(project, { rules: [] });

  const check = summarize(
    run.violations.filter((violation) => changed.has(violation.file)),
    run,
  );

  const tests = runScript({ root, manager, script: 'test', args: [context] });

  return {
    context,
    since,
    regenerate,
    check,
    tests,
    nearTheLimit: nearTheLimit(root, changed),
    ...planStaging(changedEntries(root), config, context),
    citedRemovals: citedRemovals(project, since),
    ok: regenerate.ok && check.errorCount === 0 && tests.ok,
  };
}

function requireScripts(root: string): void {
  const manifest: unknown = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const scripts = isRecord(manifest) && isRecord(manifest['scripts']) ? manifest['scripts'] : {};
  const missing = SCRIPTS.filter((script) => typeof scripts[script] !== 'string');

  if (missing.length > 0) {
    throw new CliError(
      `package.json has no ${missing.map((script) => `"${script}"`).join(' and no ')} script.`,
      'Run `npx ddd-ts-kit init --force` to add the scripts of this version, then verify the slice again.',
    );
  }
}
