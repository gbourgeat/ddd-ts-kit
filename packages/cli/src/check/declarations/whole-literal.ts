import type { Scan } from '../scan/scan.js';
import type { ListPart } from '../text/list-part.js';

/** The value of an argument that is one string literal and nothing else; undefined for anything else. */
export function wholeLiteral(scan: Scan, argument: ListPart): string | undefined {
  const literal = scan.strings.find((candidate) => candidate.start === argument.start);

  return literal !== undefined && literal.end === argument.start + argument.code.length ? literal.value : undefined;
}
