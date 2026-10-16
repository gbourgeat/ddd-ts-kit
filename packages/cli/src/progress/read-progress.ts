import type { Config } from '../config/index.js';
import type { Workspace } from '../workspace/index.js';
import type { Progress, RemainingCount, SlicesProgress } from './progress.js';
import { readRemaining } from './read-remaining.js';
import { readSlices, SLICES_FILE } from './read-slices.js';
import type { Remaining } from './remaining.js';
import type { Slice } from './slice.js';

const PLAN_FILE = 'docs/architecture/plan.md';

/** What `status` says, read from the plan, the slices table and the markers of the tree; a missing file is not an error. */
export function readProgress(ws: Workspace, config: Config): Progress {
  const slices = readSlices(ws);

  return {
    next: /^Next:[ \t]*(\S.*?)\s*$/m.exec(ws.read(PLAN_FILE) ?? '')?.[1] ?? null,
    slices: slices === undefined ? null : slicesProgress(slices),
    remaining: countsOf(readRemaining(ws, config), Object.keys(config.contexts)),
  };
}

function slicesProgress(rows: readonly Slice[]): SlicesProgress {
  const owners = [...new Set(rows.map((row) => row.owner))].sort();

  return {
    file: SLICES_FILE,
    rows,
    byStatus: idsByStatus(rows),
    byOwner: Object.fromEntries(owners.map((owner) => [owner, idsByStatus(rows.filter((row) => row.owner === owner))])),
    duplicates: [...new Set(rows.map((row) => row.id).filter((id, index, ids) => ids.indexOf(id) !== index))],
    unscoped: [...new Set(rows.map((row) => row.id).filter((id) => /^\d+$/.test(id)))],
  };
}

function idsByStatus(rows: readonly Slice[]): Record<string, string[]> {
  const statuses = [...new Set(rows.map((row) => row.status))].sort();

  return Object.fromEntries(
    statuses.map((status) => [status, rows.filter((row) => row.status === status).map((row) => row.id)]),
  );
}

function countsOf(remaining: readonly Remaining[], declared: readonly string[]): RemainingCount[] {
  const names = [...new Set([...declared, ...remaining.map((left) => left.context)])]
    .filter((name) => name !== '')
    .sort();

  const count = (context: string, kind: Remaining['kind']): number =>
    remaining.filter((left) => left.context === context && left.kind === kind).length;

  const counted = (context: string): RemainingCount => ({
    context,
    domain: count(context, 'domain'),
    platform: count(context, 'platform'),
    test: count(context, 'test'),
  });

  const elsewhere = counted('');

  return [...names.map(counted), ...(elsewhere.domain + elsewhere.platform + elsewhere.test > 0 ? [elsewhere] : [])];
}
