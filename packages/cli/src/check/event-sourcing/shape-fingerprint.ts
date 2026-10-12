import { createHash } from 'node:crypto';
import type { Scan } from '../scan/scan.js';
import { matchingBracket } from '../text/matching-bracket.js';

/**
 * The fingerprint of the shape a type declares in the file: the members of its body, comments
 * left out, whitespace outside literals removed, sorted. Two declarations of the same fields
 * have the same fingerprint whatever their layout and order; any other change of a field, of
 * its type or of a literal in it gives another one. `undefined` when the file declares no such
 * interface or object type.
 */
export function shapeFingerprint(scan: Scan, typeName: string): string | undefined {
  const declared = new RegExp(
    `(?<![\\w$.])(?:interface\\s+${typeName}(?![\\w$])[^{]*|type\\s+${typeName}\\s*=\\s*)\\{`,
  ).exec(scan.code);

  if (declared === null) {
    return undefined;
  }

  const open = declared.index + declared[0].length - 1;
  const members = membersOf(scan, open + 1, matchingBracket(scan.code, open));

  return `sha256:${createHash('sha256').update(members.sort().join(';')).digest('hex').slice(0, 16)}`;
}

/** The members between two offsets, split at the separators of depth zero, each without its whitespace, literals kept. */
function membersOf(scan: Scan, from: number, to: number): string[] {
  const members: string[] = [];
  let current = '';
  let depth = 0;

  for (let at = from; at < to; at += 1) {
    const literal = scan.strings.find((record) => record.start === at);
    const char = scan.code.charAt(at);

    if (literal !== undefined) {
      current += JSON.stringify(literal.value);
      at = literal.end - 1;
    } else if (depth === 0 && ';,\n'.includes(char)) {
      members.push(current);
      current = '';
    } else {
      depth += depthChange(char);
      current += /\s/.test(char) ? '' : char;
    }
  }

  return [...members, current].filter((member) => member !== '');
}

function depthChange(char: string): number {
  if ('([{'.includes(char)) {
    return 1;
  }

  return ')]}'.includes(char) ? -1 : 0;
}
