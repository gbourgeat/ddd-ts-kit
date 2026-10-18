import type { Slice } from '../progress/slice.js';
import { aggregatesOf } from './aggregates-of.js';
import type { Batch, Wave } from './wave-plan.js';

/** Past this many rows, an agent runs out of turns or context before its report. */
const ROWS_PER_BATCH = 2;

/** What `batchedWaves` cuts. */
export interface WaveRows {
  /** The rows to show, in the order of the file. */
  readonly rows: readonly Slice[];
  /** The wave of every planned row, by id: a dependency it does not hold is done. */
  readonly numbers: ReadonlyMap<string, number>;
}

/** A batch being cut. */
interface Draft {
  readonly owner: string;
  readonly context: string;
  readonly rows: Slice[];
  aggregates: string[];
}

/**
 * The rows in their waves, each wave cut into batches: one owner and one context per batch, two
 * rows at most, and two rows together only when their `Start with` names the same aggregate. A
 * row never waits for a row of its own wave: what it depends on is in an earlier one.
 */
export function batchedWaves(input: WaveRows): Wave[] {
  const { rows, numbers } = input;
  const waves = [...new Set(rows.map((row) => numbers.get(row.id) ?? 0))].sort((left, right) => left - right);

  return waves.map((wave) => ({
    wave,
    batches: batchesOf(wave, cut(rows.filter((row) => numbers.get(row.id) === wave)), input),
  }));
}

function cut(rows: readonly Slice[]): Draft[] {
  const drafts: Draft[] = [];

  for (const row of rows) {
    const aggregates = aggregatesOf(row.startWith);

    const joined = drafts.find(
      (draft) =>
        draft.owner === row.owner &&
        draft.context === row.context &&
        draft.rows.length < ROWS_PER_BATCH &&
        aggregates.some((name) => draft.aggregates.includes(name)),
    );

    if (joined === undefined) {
      drafts.push({ owner: row.owner, context: row.context, rows: [row], aggregates });
    } else {
      joined.rows.push(row);
      joined.aggregates = [...new Set([...joined.aggregates, ...aggregates])].sort();
    }
  }

  return drafts;
}

function batchesOf(wave: number, drafts: readonly Draft[], input: WaveRows): Batch[] {
  const id = (draft: Draft): string => `W${wave}.${drafts.indexOf(draft) + 1}`;

  return drafts.map((draft) => {
    const neighbours = drafts.filter((other) => other !== draft && other.context === draft.context);
    const unknown = (other: Draft): boolean => draft.aggregates.length === 0 || other.aggregates.length === 0;

    return {
      id: id(draft),
      owner: draft.owner,
      context: draft.context,
      rows: draft.rows.map((row) => ({
        id: row.id,
        kind: row.kind,
        slice: row.slice,
        status: row.status,
        waitingFor: row.dependsOn.filter((dependency) => input.numbers.has(dependency)),
      })),
      aggregates: draft.aggregates,
      brief: briefOf(draft, drafts, id(draft)),
      sameFiles: neighbours.filter((other) => draft.aggregates.some((name) => other.aggregates.includes(name))).map(id),
      unknownOverlap: neighbours.filter(unknown).map(id),
    };
  });
}

/**
 * The `worker-scope` command of a batch owned by the worker of its context. Two batches of one
 * context in one wave run side by side: each gets a worktree and a branch named after its id.
 */
function briefOf(draft: Draft, drafts: readonly Draft[], batch: string): string | null {
  if (draft.owner !== draft.context) {
    return null;
  }

  const { context } = draft;
  const workers = drafts.filter((other) => other.owner === context && other.context === context);
  const rows = draft.rows.map((row) => row.id).join(',');
  const command = `npx ddd-ts-kit worker-scope ${context} --base origin/main --rows ${rows}`;
  const own = `${context}-${batch.toLowerCase()}`;

  return workers.length === 1 ? command : `${command} --worktree .worktrees/${own} --branch build/${own}`;
}
