import { scan } from '../../../check/scan/scan';

/**
 * What the `entities` list of a TypeORM schema index holds, each item as written, a spread
 * included: read on the code, comments and strings left out, to the bracket that closes the list.
 */
export function entitiesList(index: string): string[] {
  const { code } = scan(index);
  const opened = /\bentities\b[^=;]*=\s*\[/.exec(code);

  if (opened === null) {
    return [];
  }

  const from = opened.index + opened[0].length;
  let depth = 1;
  let at = from;

  while (at < code.length && depth > 0) {
    depth += code[at] === '[' ? 1 : code[at] === ']' ? -1 : 0;
    at += 1;
  }

  return code
    .slice(from, at - 1)
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '');
}
