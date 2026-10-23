import fs from 'node:fs';
import path from 'node:path';
import { staleNamesAt } from '../citations/stale-names-at';
import type { Config } from '../config';
import { KINDS } from '../generate/kinds';
import { Workspace } from '../workspace';
import { briefedRows } from './briefed-rows';
import type { BriefedSlice } from './briefed-slice';
import { briefingOf } from './briefing-of';
import type { FoundWorker } from './find-worker';
import { namedPaths } from './named-paths';
import { REPORT_FILE } from './report-file';
import { workerGenerators } from './worker-generators';
import type { WorkerProgress } from './worker-progress';

/** What a new agent of a stopped worker is briefed from. */
export interface ResumedWorker {
  readonly worker: FoundWorker;
  readonly config: Config;
  /** The name of the project directory. */
  readonly project: string;
}

/** The report of the earlier agent is quoted up to this many words. */
const QUOTED_WORDS = 200;

/**
 * The briefing of a new agent for a stopped worker: the normal briefing of its next row only (one
 * row is one agent's work). A row started by an earlier agent adds what it left: its files, to
 * continue and never to regenerate, and its report quoted. Null once every row is committed.
 */
export function resumeBriefing(progress: WorkerProgress, resumed: ResumedWorker): string | null {
  const { worker, config } = resumed;
  const row = progress.rows.find((candidate) => candidate.state !== 'committed');

  if (row === undefined) {
    return null;
  }

  const trunk = worker.scope.base ?? 'origin/main';
  const slices = briefedRow(worker, row.id);

  const briefing = briefingOf({
    config,
    context: worker.scope.context,
    project: resumed.project,
    root: worker.project,
    branch: worker.branch ?? `build/${worker.scope.context}`,
    trunk,
    generators: workerGenerators(KINDS),
    slices,
    citations: staleNamesAt(worker.project, config, { ref: trunk, rows: slices.map((slice) => slice.id) }),
  });

  return progress.phase === 'mid-row' ? `${briefing}\n\n${resumeBlock(progress, { worker, id: row.id })}` : briefing;
}

/** The row with its rules; none when the slices file of the worktree no longer holds it. */
function briefedRow(worker: FoundWorker, id: string): readonly BriefedSlice[] {
  try {
    return briefedRows(new Workspace(worker.project, false), worker.scope.context, [id]).slices;
  } catch {
    return [];
  }
}

function resumeBlock(progress: WorkerProgress, started: { worker: FoundWorker; id: string }): string {
  const { context } = started.worker.scope;
  const report = quotedReport(started.worker.project);

  return [
    `Resume: row #${started.id} was started by an earlier agent. These files exist and are yours to continue: never`,
    `regenerate, delete or reset them: ${namedPaths(progress.inSlice)}.`,
    `Start with \`npx ddd-ts-kit todo ${context}\` and \`verify-slice\`, not with the generators.`,
    ...(report === undefined ? ['It left no report.'] : ['Its report:', ...report.map((line) => `> ${line}`)]),
  ].join('\n');
}

function quotedReport(project: string): string[] | undefined {
  const file = path.join(project, REPORT_FILE);

  if (!fs.existsSync(file)) {
    return undefined;
  }

  const kept: string[] = [];
  let count = 0;

  for (const line of fs.readFileSync(file, 'utf8').trim().split('\n')) {
    const words = line.split(/\s+/).filter((word) => word !== '');

    if (count + words.length > QUOTED_WORDS) {
      kept.push(`${words.slice(0, QUOTED_WORDS - count).join(' ')} (...)`);

      return kept;
    }

    kept.push(line);
    count += words.length;
  }

  return kept;
}
