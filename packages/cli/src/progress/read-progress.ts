import { runGit } from '../commit/run-git.js';
import type { Config } from '../config/index.js';
import { attributeMarkers } from '../story/attribute-markers.js';
import { projectContexts } from '../story/project-contexts.js';
import { unclosedStories } from '../story/unclosed-stories.js';
import type { Workspace } from '../workspace/index.js';
import type { Progress, RemainingCount, SlicesProgress } from './progress.js';
import { readRemaining } from './read-remaining.js';
import { readSlices, SLICES_FILE } from './read-slices.js';
import type { Remaining } from './remaining.js';
import type { Slice } from './slice.js';
import { statusRowOf } from './status-row-of.js';

const PLAN_FILE = 'docs/architecture/plan.md';

/**
 * What `status` says, read from the plan, the slices table and the markers of the tree; a missing
 * file is not an error. `onBranches` holds the ids of the rows on a worker's branch with commits
 * ahead of its base, which a row not done may wait for.
 */
export function readProgress(ws: Workspace, config: Config, onBranches: ReadonlySet<string>): Progress {
  const slices = readSlices(ws);
  const remaining = readRemaining(ws, config);
  const around = { root: ws.root, onBranches, remaining, contexts: projectContexts(ws, config) };

  return {
    next: /^Next:[ \t]*(\S.*?)\s*$/m.exec(ws.read(PLAN_FILE) ?? '')?.[1] ?? null,
    slices: slices === undefined ? null : slicesProgress(slices, around),
    remaining: countsOf(remaining, Object.keys(config.contexts)),
  };
}

/** What the rows are read against: the project, the branches of the workers, its markers and its contexts. */
interface Around {
  readonly root: string;
  readonly onBranches: ReadonlySet<string>;
  readonly remaining: readonly Remaining[];
  readonly contexts: readonly string[];
}

function slicesProgress(rows: readonly Slice[], { root, onBranches, remaining, contexts }: Around): SlicesProgress {
  const ids = [...new Set(rows.map((row) => row.id))];
  const attribute = (markers: readonly Remaining[]) => attributeMarkers(root, markers, { ids, git: runGit });

  const owners = [...new Set(rows.map((row) => row.owner))].sort();

  return {
    file: SLICES_FILE,
    rows: rows.map((row) => statusRowOf(row, { rows, onBranches })),
    byStatus: idsByStatus(rows),
    byOwner: Object.fromEntries(owners.map((owner) => [owner, idsByStatus(rows.filter((row) => row.owner === owner))])),
    duplicates: [...new Set(rows.map((row) => row.id).filter((id, index, ids) => ids.indexOf(id) !== index))],
    unscoped: [...new Set(rows.map((row) => row.id).filter((id) => /^\d+$/.test(id)))],
    unclosed: unclosedStories({ rows, remaining, contexts, attribute }),
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
    review: count(context, 'review'),
  });

  const elsewhere = counted('');

  const isEmpty = (counts: RemainingCount): boolean =>
    counts.domain + counts.platform + counts.test + counts.review === 0;

  return [...names.map(counted), ...(isEmpty(elsewhere) ? [] : [elsewhere])];
}
