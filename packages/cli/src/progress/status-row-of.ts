import type { StatusRow } from './progress.js';
import type { Slice } from './slice.js';

/** What a row is read against. */
export interface RowsAround {
  /** Every row of the slices file. */
  readonly rows: readonly Slice[];
  /** The ids of the rows briefed to a worker whose branch has commits its base does not have. */
  readonly onBranches: ReadonlySet<string>;
}

/**
 * A row with whether it can start: on the trunk when every dependency is done, on a branch when
 * each one not done is on its way there, else waiting. A dependency is done when the rows that
 * carry its id are all done; an id no row carries is never done. A done row is left as it is.
 */
export function statusRowOf(row: Slice, around: RowsAround): StatusRow {
  if (row.status === 'done') {
    return row;
  }

  const isDone = (id: string): boolean => {
    const carrying = around.rows.filter((other) => other.id === id);

    return carrying.length > 0 && carrying.every((other) => other.status === 'done');
  };

  const waitingFor = row.dependsOn.filter((id) => !isDone(id));

  return { ...row, ready: readyOf(waitingFor, around.onBranches), waitingFor };
}

function readyOf(waitingFor: readonly string[], onBranches: ReadonlySet<string>): 'trunk' | 'branch' | 'waiting' {
  if (waitingFor.length === 0) {
    return 'trunk';
  }

  return waitingFor.every((id) => onBranches.has(id)) ? 'branch' : 'waiting';
}
