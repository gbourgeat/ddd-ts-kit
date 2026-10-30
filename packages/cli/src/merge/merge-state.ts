import fs from 'node:fs';
import path from 'node:path';
import { isRecord } from '../config/values/is-record';
import { jsonObject } from '../init/json-object';
import { KIT_FOLDER } from '../workspace/kit-folder';
import type { MergeReport } from './merge-report';

/** Written while a merge of merge-trunk is in progress, next to the scope of a worker; never committed. */
const MERGE_STATE_FILE = `${KIT_FOLDER}/merge.json`;

/** The steps run once, in their order, after the conflicts are settled; regenerate and the gate run again on each `--continue`. */
export type MergeStep = 'install' | 'migrations' | 'adrs';

/**
 * What `--continue` needs of a merge merge-trunk started: the report so far (the trunk, the base
 * and its evidence, what was settled, what is left), whether it lands the branch, whether the
 * lockfile needs an install, and the steps already done.
 */
export interface MergeState {
  readonly report: MergeReport;
  /** HEAD when the merge started. */
  readonly ours: string;
  readonly toLand: boolean;
  readonly install: boolean;
  readonly done: readonly MergeStep[];
}

/** Reads, writes or removes the state of the merge in progress of the project at `root`. */
export const mergeState = {
  file: (root: string): string => path.join(root, MERGE_STATE_FILE),

  read(root: string): MergeState | undefined {
    const file = mergeState.file(root);
    const json = fs.existsSync(file) ? jsonObject(fs.readFileSync(file, 'utf8')) : undefined;
    const { report, ours, toLand, install, done } = json ?? {};

    if (!isReport(report) || typeof ours !== 'string') {
      return undefined;
    }

    return { report, ours, toLand: toLand === true, install: install === true, done: steps(done) };
  },

  write(root: string, state: MergeState): void {
    fs.mkdirSync(path.dirname(mergeState.file(root)), { recursive: true });
    fs.writeFileSync(mergeState.file(root), `${JSON.stringify(state, null, 2)}\n`);
  },

  remove(root: string): void {
    fs.rmSync(mergeState.file(root), { force: true });
  },
};

/** What a state file written by this command holds; the kit writes it, a person never does. */
function isReport(value: unknown): value is MergeReport {
  return (
    isRecord(value) &&
    typeof value['branch'] === 'string' &&
    isRecord(value['trunk']) &&
    isRecord(value['base']) &&
    isRecord(value['conflicts']) &&
    Array.isArray(value['automatic']) &&
    Array.isArray(value['forYou'])
  );
}

function steps(value: unknown): MergeStep[] {
  const known: readonly MergeStep[] = ['install', 'migrations', 'adrs'];

  return Array.isArray(value) ? known.filter((step) => value.includes(step)) : [];
}
