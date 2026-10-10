import { callEnd } from './call-end.js';

const CHAINED_CALL = /^\s*\.\s*[\w$]+\s*(?:<[^<>()]*>)?\s*\(/;

/** Offset just after the last call chained on the one whose arguments start at `open`: `a(...).b(...).c(...)`. */
export function chainEnd(code: string, open: number): number {
  let end = callEnd(code, open);

  for (;;) {
    const next = CHAINED_CALL.exec(code.slice(end, end + 200));

    if (next === null) return end;

    end = callEnd(code, end + next[0].length);
  }
}
