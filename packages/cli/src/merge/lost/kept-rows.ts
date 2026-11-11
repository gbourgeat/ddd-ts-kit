import type { Slice } from '../../progress/slice';
import { slicesIn } from '../../progress/slices-in';
import type { MergeFinding } from './merge-finding';
import type { MergeSides } from './merge-sides';

type Rows = ReadonlyMap<string, Slice>;
type AllRows = Readonly<Record<'base' | 'ours' | 'theirs' | 'result' | 'fork', Rows>>;

/**
 * The rows of the slices file at `file` that a merge undid: a row done on one side and not done
 * in the result, a row of one side gone from the result. A row one side deleted, or reopened
 * after the base had it done, is that side's decision. For the side brought in, the row is read
 * at `fork` too, the file where the sides parted: a base found on the branch (a landed commit)
 * may hold a row, or a status, that side never took, and what it never held it did not undo.
 */
export function keptRows(sides: MergeSides, file: string, fork: string | undefined): MergeFinding[] {
  const ours = rowsOf(sides.ours.get(file));
  const theirs = rowsOf(sides.theirs.get(file));
  const base = rowsOf(sides.base.get(file));
  const rows = { base, ours, theirs, result: rowsOf(sides.result.get(file)), fork: rowsOf(fork) };

  return [...new Set([...ours.keys(), ...theirs.keys()])].flatMap((id): MergeFinding[] => {
    const kind = undoneKind(id, rows);
    const side = ours.has(id) ? 'ours' : 'theirs';
    const row = ours.get(id) ?? theirs.get(id);

    return kind === undefined || row === undefined
      ? []
      : [{ kind, file, line: lineOf(sides[side].get(file) ?? '', id), side, text: `#${id} ${row.slice}` }];
  });
}

function rowsOf(text: string | undefined): Rows {
  return new Map((slicesIn(text ?? '') ?? []).map((row) => [row.id, row]));
}

function undoneKind(id: string, rows: AllRows): MergeFinding['kind'] | undefined {
  if (!rows.result.has(id)) {
    return deletedBySide(id, rows) ? undefined : 'row-lost';
  }

  return isUndone(id, rows) ? 'row-not-done' : undefined;
}

function deletedBySide(id: string, { base, ours, theirs, fork }: AllRows): boolean {
  return base.has(id) && (!ours.has(id) || (!theirs.has(id) && fork.has(id)));
}

function isUndone(id: string, { base, ours, theirs, result, fork }: AllRows): boolean {
  const done = (side: Rows): boolean => side.get(id)?.status === 'done';
  const reopened = done(base) && (!done(ours) || (!done(theirs) && done(fork)));

  return (done(ours) || done(theirs)) && !done(result) && !reopened;
}

function lineOf(text: string, id: string): number {
  const index = text.split('\n').findIndex((line) => line.split('|')[1]?.trim() === id);

  return index + 1;
}
