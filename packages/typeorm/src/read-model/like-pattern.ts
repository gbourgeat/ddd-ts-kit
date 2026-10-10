import type { FilterOperator } from '@ddd-ts-kit/kernel';

/** The `LIKE` pattern of a text search, the text itself taken literally: `%`, `_` and `\` are escaped by `\`. */
export function likePattern(operator: FilterOperator, text: string): string {
  const literal = text.replace(/[\\%_]/g, (special) => `\\${special}`);

  return operator === 'startsWith' ? `${literal}%` : `%${literal}%`;
}
