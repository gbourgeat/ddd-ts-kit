/** Lines a merge settled, or one conflict with its three sides as diff3 markers wrote them. */
export type Segment = SettledLines | ConflictBlock;

interface SettledLines {
  readonly kind: 'settled';
  readonly lines: readonly string[];
}

export interface ConflictBlock {
  readonly kind: 'conflict';
  readonly ours: readonly string[];
  readonly base: readonly string[];
  readonly theirs: readonly string[];
  /** The block as written, markers included, to write it back untouched. */
  readonly raw: readonly string[];
  /** The line of its first marker in the file, from 1. */
  readonly line: number;
}

const OPENING = /^<{7}(?: |$)/;
const BASE = /^\|{7}(?: |$)/;
const MIDDLE = /^={7}$/;
const CLOSING = /^>{7}(?: |$)/;

type Part = 'ours' | 'base' | 'theirs';

/**
 * The segments of a file a merge wrote with diff3 markers, in their order. A block left open at
 * the end of the file is read as settled lines: nothing is resolved from a block not understood.
 */
export function conflictBlocks(text: string): Segment[] {
  const segments: Segment[] = [];
  let settled: string[] = [];
  let open: { parts: Record<Part, string[]>; part: Part; raw: string[]; line: number } | undefined;

  text.split('\n').forEach((line, index) => {
    if (open === undefined) {
      if (OPENING.test(line)) {
        segments.push({ kind: 'settled', lines: settled });
        settled = [];
        open = { parts: { ours: [], base: [], theirs: [] }, part: 'ours', raw: [line], line: index + 1 };
      } else {
        settled.push(line);
      }

      return;
    }

    open.raw.push(line);
    open = advanced(open, line, segments);
  });

  const last: Segment = { kind: 'settled', lines: [...settled, ...(open?.raw ?? [])] };

  return [...segments, last].filter((segment) => segment.kind === 'conflict' || segment.lines.length > 0);
}

function advanced(
  open: { parts: Record<Part, string[]>; part: Part; raw: string[]; line: number },
  line: string,
  segments: Segment[],
): typeof open | undefined {
  if (BASE.test(line) && open.part === 'ours') {
    return { ...open, part: 'base' };
  }

  if (MIDDLE.test(line) && open.part !== 'theirs') {
    return { ...open, part: 'theirs' };
  }

  if (CLOSING.test(line) && open.part === 'theirs') {
    segments.push({ kind: 'conflict', ...open.parts, raw: open.raw, line: open.line });

    return undefined;
  }

  open.parts[open.part].push(line);

  return open;
}
