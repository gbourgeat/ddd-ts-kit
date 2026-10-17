import fs from 'node:fs';
import path from 'node:path';
import { runGit } from '../commit/run-git.js';
import { readConfig } from '../config/index.js';
import { readRemaining } from '../progress/read-remaining.js';
import { readSlices } from '../progress/read-slices.js';
import { changedEntries } from '../slice/changed-entries.js';
import { planStaging } from '../slice/plan-staging.js';
import { Workspace } from '../workspace/index.js';
import { nextStepOf } from './next-step-of.js';
import { readAgentRecord } from './read-agent-record.js';
import { readVerification, type SliceNow } from './read-verification.js';
import { REPORT_FILE } from './report-file.js';
import { rowCommits } from './row-commits.js';
import type { WorkerFile } from './worker-file.js';
import type { AgentRecord, ProgressReport, ProgressRow, WorkerProgress } from './worker-progress.js';

/** How the conductor asks: `stopped` when it knows the agent stopped (a notification), `fresh` for a new agent whatever the last one did. */
export interface ProgressRequest {
  readonly stopped?: boolean;
  readonly fresh?: boolean;
}

/**
 * Where the worker of the project at `project` stands, read from its branch, its working tree
 * and the files the kit writes in `.ddd-ts-kit/`. Reads only; undefined when its config cannot
 * be read.
 */
export function progressOf(
  project: string,
  scope: WorkerFile,
  request: ProgressRequest = {},
): WorkerProgress | undefined {
  const config = configOf(project);

  if (config === undefined) {
    return undefined;
  }

  const ws = new Workspace(project, false);
  const { toStage: inSlice, leftOut } = planStaging(changedEntries(project), config, scope.context);
  const changed = inSlice.map((file) => modifiedAt(path.join(project, file)));
  const head = runGit(project, ['rev-parse', 'HEAD'])?.trim();
  const rows = rowsOf(project, scope, { ws, uncommitted: inSlice.length > 0 });
  const agent = readAgentRecord(project);
  const phase = phaseOf(rows, inSlice.length > 0);
  const progressed = agent !== null && progressedIn(agent, { head, changed });
  const facts = { phase, agent, progressed, clean: inSlice.length === 0, stopped: request.stopped === true };

  return {
    rows,
    inSlice,
    leftOut,
    markers: markersOf(ws, config, scope.context),
    verification: readVerification(project, { head, changed }),
    report: reportOf(project, changed),
    agent,
    phase,
    next: nextStepOf({ ...facts, fresh: request.fresh === true }),
  };
}

type Config = ReturnType<typeof readConfig>['config'];

function configOf(project: string): Config | undefined {
  try {
    return readConfig(project).config;
  } catch {
    return undefined;
  }
}

function markersOf(ws: Workspace, config: Config, context: string): WorkerProgress['markers'] {
  const markers = readRemaining(ws, config, context);

  return {
    domain: markers.filter((left) => left.kind === 'domain').length,
    test: markers.filter((left) => left.kind === 'test').length,
  };
}

/** The run committed since it started, or changed a file of the slice. */
function progressedIn(agent: AgentRecord, now: SliceNow): boolean {
  const started = Date.parse(agent.runStartedAt);

  return now.head !== agent.runStartHead || now.changed.some((time) => time > started);
}

/** Each row of the scope file: committed, the first other one in progress when files of the slice changed, the rest to do. */
function rowsOf(project: string, scope: WorkerFile, read: { ws: Workspace; uncommitted: boolean }): ProgressRow[] {
  const ids = scope.rows ?? [];
  const names = new Map((readSlices(read.ws) ?? []).map((slice) => [slice.id, slice.slice]));

  const commits =
    scope.base === undefined ? [] : rowCommits(project, { base: scope.base, context: scope.context, rows: ids });

  const current = ids.find((id) => !commits.some((done) => done.row === id));

  return ids.map((id): ProgressRow => {
    const done = commits.find((commit) => commit.row === id);
    const slice = names.get(id) ?? '';

    if (done !== undefined) {
      return { id, slice, state: 'committed', commit: done.commit, ...(done.byOrder ? { byOrder: true } : {}) };
    }

    return { id, slice, state: id === current && read.uncommitted ? 'in progress' : 'to do' };
  });
}

function phaseOf(rows: readonly ProgressRow[], uncommitted: boolean): WorkerProgress['phase'] {
  const committed = rows.filter((row) => row.state === 'committed').length;

  if (rows.length > 0 && committed === rows.length) {
    return 'rows committed';
  }

  if (uncommitted) {
    return 'mid-row';
  }

  return committed > 0 ? 'between rows' : 'not started';
}

/** The report is current when written after the last commit and after the last change of a file of the slice. */
function reportOf(project: string, changed: readonly number[]): ProgressReport | null {
  const file = path.join(project, REPORT_FILE);

  if (!fs.existsSync(file)) {
    return null;
  }

  const modified = fs.statSync(file).mtimeMs;
  const committed = Date.parse(runGit(project, ['log', '-1', '--format=%cI'])?.trim() ?? '') || 0;

  return {
    modified: new Date(modified).toISOString(),
    current: modified >= committed && changed.every((time) => modified >= time),
  };
}

function modifiedAt(file: string): number {
  return fs.existsSync(file) ? fs.statSync(file).mtimeMs : 0;
}
