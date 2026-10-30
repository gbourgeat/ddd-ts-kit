import { endOfEnclosing } from './end-of-enclosing';

/** The parts of a list outside any bracket, trimmed: `a, f(b, c), [d, e]` has three, and a trailing comma adds none. */
export function topLevelParts(list: string): readonly string[] {
  const parts: string[] = [];
  let start = 0;

  while (start < list.length) {
    const end = endOfEnclosing(list, start, ',');

    parts.push(list.slice(start, end).trim());
    start = end + 1;
  }

  return parts.filter((part) => part !== '');
}
