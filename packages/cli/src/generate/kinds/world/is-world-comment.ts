import { WORLD_COMMENTS } from './world-comments';

const HOLE = '\u0000';

/** Each comment of `WORLD_COMMENTS`, whatever the names it holds. */
const PATTERNS = Object.values(WORLD_COMMENTS).map((comment) => {
  const written = comment(HOLE, HOLE, HOLE).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  return new RegExp(`^${written.split(HOLE).join('.+')}$`);
});

/** Whether the text of a comment is one the generator writes about an arrangement. */
export function isWorldComment(text: string): boolean {
  return PATTERNS.some((pattern) => pattern.test(text));
}
