import { SLICE_STATUS, type Slice } from '../progress/slice';

/** A row its worker has started: its commands may have run in the project already. */
export function isStarted(row: Slice): boolean {
  return row.status === SLICE_STATUS.inProgress;
}
