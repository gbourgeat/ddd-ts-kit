import { splitTopLevel } from '../check/text/split-top-level.js';

/** The entries of an object literal, by key; a shorthand entry is its own value. Comments between entries are dropped. */
export function entriesOf(literal: string): Map<string, string> {
  const inside = literal
    .trim()
    .replace(/^\{/, '')
    .replace(/\}$/, '')
    .replace(/^\s*\/\/.*$/gm, '');

  const entries = new Map<string, string>();

  for (const { code } of splitTopLevel(inside)) {
    const colon = code.indexOf(':');
    const key = (colon === -1 ? code : code.slice(0, colon)).trim();

    if (key !== '') {
      entries.set(key, colon === -1 ? key : code.slice(colon + 1).trim());
    }
  }

  return entries;
}
