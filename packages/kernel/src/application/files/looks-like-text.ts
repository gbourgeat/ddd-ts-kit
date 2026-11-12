import type { TextRule } from './text-rule';

/** Tab, line feed, form feed and carriage return are text; every other C0 control character is not. */
const TEXT_CONTROLS = new Set([9, 10, 12, 13]);

/**
 * Whether the first bytes of a content are text under a rule. Under both rules a NUL or another
 * control character refuses, which is what the head of a binary file holds; `utf-8` also demands
 * valid UTF-8, cut anywhere, and `single-byte` refuses a UTF-16 or UTF-32 byte order mark.
 */
export function looksLikeText(head: Uint8Array, rule: TextRule): boolean {
  if (!head.every((byte) => byte >= 32 || TEXT_CONTROLS.has(byte))) {
    return false;
  }

  return rule === 'utf-8' ? startsValidUtf8(head) : !startsWithWideMark(head);
}

function startsValidUtf8(head: Uint8Array): boolean {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(head, { stream: true });
  } catch {
    return false;
  }

  return true;
}

/** `FF FE` and `FE FF` open UTF-16, and UTF-32 in little endian: "ÿþ" opens no file of single-byte text. */
function startsWithWideMark(head: Uint8Array): boolean {
  const [first, second] = head;

  return (first === 0xff && second === 0xfe) || (first === 0xfe && second === 0xff);
}
