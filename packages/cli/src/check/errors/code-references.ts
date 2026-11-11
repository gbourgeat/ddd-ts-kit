import type { CodeReference } from './code-reference';

const MEMBER = /(?<![\w$.])([A-Za-z_$][\w$]*)\s*\.\s*([A-Za-z_$][\w$]*)(?![\w$]|\s*[.(])/g;

/**
 * The members of a code list a text names between two offsets, each one whole:
 * `SchedulingCodes.SlotTaken`, `KitCodes.Forbidden`. A call, a longer chain and a spread are not one.
 */
export function codeReferences(code: string, from: number, to: number): CodeReference[] {
  return [...code.slice(from, to).matchAll(MEMBER)].map((match) => ({
    list: match[1] ?? '',
    key: match[2] ?? '',
    start: from + match.index,
  }));
}
