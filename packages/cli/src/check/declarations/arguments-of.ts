import type { Scan } from '../scan/scan';
import type { ListPart } from '../text/list-part';
import { splitTopLevel } from '../text/split-top-level';
import type { Decoration } from './decoration';

/** The blanked code of each argument of a decorator, trimmed, with the offset it starts at. */
export function argumentsOf(scan: Scan, { open, close }: Decoration): ListPart[] {
  return splitTopLevel(scan.code.slice(open + 1, close)).map((part) => ({
    code: part.code,
    start: open + 1 + part.start,
  }));
}
