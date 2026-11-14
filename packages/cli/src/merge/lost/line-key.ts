import { createHash } from 'node:crypto';

/**
 * A line of a file as a trailer of a merge names it, without spaces or commas: `<file>#<hash>` of
 * the line as the lost-lines check reads it, with the side between them for a line a side lost,
 * `<file>@<side>#<hash>`.
 */
export function lineKey(file: string, text: string, side?: string): string {
  const hash = createHash('sha256').update(text).digest('hex').slice(0, 12);

  return side === undefined ? `${file}#${hash}` : `${file}@${side}#${hash}`;
}
