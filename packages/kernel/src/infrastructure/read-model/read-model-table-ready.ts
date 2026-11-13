import type { ReadModelTableState } from '../../application/read-model/read-model-table-state';

/** Whether the table can hold the trace of a deleted row: one verdict, for a store before its first trace and for the tables an application lists. */
export function readModelTableReady({ exists, refusing, unfit }: ReadModelTableState): boolean {
  return exists && refusing.length === 0 && unfit.length === 0;
}
