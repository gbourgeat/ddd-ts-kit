import type { TextSearch } from '@ddd-ts-kit/kernel';

/** The `LIKE` pattern of a text search, the text itself taken literally: `%`, `_` and `\` are escaped by `\`. */
export function likePattern(operator: TextSearch, text: string): string {
  const literal = text.replace(/[\\%_]/g, (special) => `\\${special}`);

  return operator === 'startsWith' || operator === 'startsWithIgnoringCase' ? `${literal}%` : `%${literal}%`;
}
