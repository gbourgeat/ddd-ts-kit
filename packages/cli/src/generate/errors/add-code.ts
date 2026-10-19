import type { CodesList } from './codes-list.js';

/** One entry of the list: the name of a refusal class and the code it sets. */
export interface CodeEntry {
  readonly key: string;
  readonly code: string;
}

/**
 * The source of a `codes.ts` with one more entry at the end of its list, in the order it is
 * written: the first refusal of a context comes first. The source itself when the class is
 * already listed.
 */
export function addCode(source: string, list: CodesList, { key, code }: CodeEntry): string {
  if (list.entries.has(key)) {
    return source;
  }

  const entry = `  ${key}: '${code}',`;
  const after = source.slice(list.close);

  if (source.slice(list.open + 1, list.close).trim() === '') {
    return `${source.slice(0, list.open + 1)}\n${entry}\n${after}`;
  }

  const before = source.slice(0, list.close).trimEnd();

  return `${before}${before.endsWith(',') ? '' : ','}\n${entry}\n${after}`;
}
