import { foldCase } from './fold-case';
import type { TextSearch } from './text-search';

const FINDS: Readonly<Record<TextSearch, (text: string, part: string) => boolean>> = {
  contains: (text, part) => text.includes(part),
  startsWith: (text, part) => text.startsWith(part),
  containsIgnoringCase: (text, part) => foldCase(text).includes(foldCase(part)),
  startsWithIgnoringCase: (text, part) => foldCase(text).startsWith(foldCase(part)),
};

/** Whether a text search finds `part` in `text`: the reference every translator is held to. */
export function findsText(operator: TextSearch, text: string, part: string): boolean {
  return FINDS[operator](text, part);
}
