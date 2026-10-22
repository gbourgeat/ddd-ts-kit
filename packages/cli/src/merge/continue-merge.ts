import fs from 'node:fs';
import path from 'node:path';
import { isRecord } from '../config/values/is-record';
import { runScript } from '../slice/run-script';
import { commitMerge } from './commit-merge';
import { lostLinesGate } from './lost-lines-gate';
import type { MergeContext } from './merge-context';
import type { MergeReport, StepRun } from './merge-report';
import { type MergeState, mergeState } from './merge-state';
import { MERGE_STEPS } from './merge-steps';
import { NEXT_STEPS } from './next-steps';
import { unmergedEntries } from './unmerged-entries';

/** How `--continue` goes on. */
export interface ContinueOptions {
  readonly acceptLost: boolean;
  readonly now: Date;
}

const MARKER = /^(?:<{7}|={7}|>{7}|\|{7})(?: |$)/m;

/**
 * Goes on with a merge whose conflicts are settled: refuses while a path is unmerged or keeps
 * conflict markers, runs the steps not done yet (install, migrations, decision records), then
 * regenerate, the lost-lines gate on the uncommitted result, and the commit of the merge's
 * paths. Each stop keeps the merge in progress and its state for the next `--continue`.
 */
export function continueMerge(context: MergeContext, state: MergeState, options: ContinueOptions): MergeReport {
  const unsettled = unsettledPaths(context, state);

  if (unsettled !== undefined) {
    return stopped(context, state, { why: unsettled, next: NEXT_STEPS.resolve });
  }

  let current = state;

  for (const step of (['install', 'migrations', 'adrs'] as const).filter((name) => !state.done.includes(name))) {
    const outcome = MERGE_STEPS[step](context, current, options.now);

    current = {
      ...current,
      report: outcome.report,
      done: outcome.stop === undefined ? [...current.done, step] : current.done,
    };

    if (outcome.stop !== undefined) {
      return stopped(context, current, outcome.stop);
    }
  }

  return checkedAndCommitted(context, current, options);
}

function checkedAndCommitted(context: MergeContext, state: MergeState, options: ContinueOptions): MergeReport {
  const regenerate = regenerated(context);
  const withRegenerate: MergeState = { ...state, report: { ...state.report, regenerate } };

  if (regenerate.status === 'failed') {
    return stopped(context, withRegenerate, { why: '`npm run regenerate` failed', next: NEXT_STEPS.regenerate });
  }

  const lostLines = lostLinesGate(context.repo, options.acceptLost);
  const checked: MergeState = { ...withRegenerate, report: { ...withRegenerate.report, lostLines } };

  if (lostLines.errors.length > 0) {
    return stopped(context, checked, {
      why: `the merge lost ${lostLines.errors.length} line(s), row(s) or test(s)`,
      next: NEXT_STEPS.lostLines,
    });
  }

  return committed(context, checked);
}

/** Commits the paths of the merge, or stops on what blocks it. */
function committed(context: MergeContext, checked: MergeState): MergeReport {
  const commit = commitMerge(context.repo);
  const report = { ...checked.report, leftOut: commit.leftOut };

  if (commit.commit === undefined) {
    const why =
      commit.failure === undefined
        ? "changed paths that are not the merge's"
        : `git commit refused:\n${commit.failure}`;

    return stopped(
      context,
      { ...checked, report },
      { why, next: commit.failure === undefined ? NEXT_STEPS.leftOut : NEXT_STEPS.commit },
    );
  }

  mergeState.remove(context.root);

  const { stop, ...settled } = report;

  return {
    ...settled,
    status: 'committed',
    commit: commit.commit,
    next: checked.toLand ? NEXT_STEPS.landed : NEXT_STEPS.committed,
  };
}

/** The paths still unmerged in the index, or still holding conflict markers; undefined when every one is settled. */
function unsettledPaths({ repo }: MergeContext, { report }: MergeState): string | undefined {
  const unmerged = [...unmergedEntries(repo.top).keys()];

  if (unmerged.length > 0) {
    return `still unmerged: ${unmerged.join(', ')}`;
  }

  const marked = report.forYou
    .map((entry) => entry.file)
    .filter((file) => MARKER.test(readIfPresent(path.join(repo.top, file))));

  return marked.length === 0 ? undefined : `conflict markers left in ${marked.join(', ')}`;
}

/** `npm run regenerate` of the project; skipped without the config of the kit or without the script. */
function regenerated({ root, config }: MergeContext): StepRun {
  if (config === undefined) {
    return { status: 'skipped', output: 'no ddd-ts-kit.config.json: nothing is derived here' };
  }

  if (!hasScript(root, 'regenerate')) {
    return {
      status: 'skipped',
      output: 'package.json has no "regenerate" script: run `npx ddd-ts-kit init --force` to add it',
    };
  }

  const run = runScript({ root, manager: config.stack.packageManager, script: 'regenerate' });

  return run.ok ? { status: 'ok' } : { status: 'failed', output: run.output };
}

function hasScript(root: string, script: string): boolean {
  try {
    const manifest: unknown = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

    return isRecord(manifest) && isRecord(manifest['scripts']) && typeof manifest['scripts'][script] === 'string';
  } catch {
    return false;
  }
}

function stopped(context: MergeContext, state: MergeState, stop: { why: string; next: string }): MergeReport {
  const report: MergeReport = { ...state.report, status: 'stopped', stop: stop.why, next: stop.next };

  mergeState.write(context.root, { ...state, report });

  return report;
}

function readIfPresent(file: string): string {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}
