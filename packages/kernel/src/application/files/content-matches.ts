import { signatureOf } from './signature-of.js';
import { mediaTypeOf } from './media-type-of.js';

/** Office and e-book documents are zip archives: their signature is the one of a zip. */
const ZIP_CONTAINERS = new Set([
  'application/zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/epub+zip',
]);

/** Text has no signature: it is accepted when its first bytes are UTF-8 without control characters. */
const TEXT_TYPES = new Set(['text/plain', 'text/csv', 'text/markdown', 'application/json']);

/** Tab, line feed, form feed and carriage return are text; every other C0 control character is not. */
const TEXT_CONTROLS = new Set([9, 10, 12, 13]);

/**
 * Whether the first bytes of a content are what its declared media type says, read on the bytes
 * and never on a file name: a PDF starts with `%PDF-`, a PNG with its eight bytes. A binary
 * format the kit does not recognise, SVG included, never matches.
 */
export function contentMatches(head: Uint8Array, declared: string): boolean {
  const essence = mediaTypeOf(declared);
  const signature = signatureOf(head);

  if (signature !== undefined) {
    return signature === essence || (signature === 'application/zip' && ZIP_CONTAINERS.has(essence));
  }

  return TEXT_TYPES.has(essence) && looksLikeText(head);
}

function looksLikeText(head: Uint8Array): boolean {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(head, { stream: true });
  } catch {
    return false;
  }

  return head.every((byte) => byte >= 32 || TEXT_CONTROLS.has(byte));
}
