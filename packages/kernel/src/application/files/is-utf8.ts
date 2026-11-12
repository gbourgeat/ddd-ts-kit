/**
 * Whether bytes are valid UTF-8 as a whole: what a reader of a file received under the text rule
 * `single-byte` asks before it decodes, `new TextDecoder(isUtf8(bytes) ? 'utf-8' : 'windows-1252')`.
 * Text in a single-byte encoding with one accented letter is almost never valid UTF-8, and pure
 * ASCII reads the same in both.
 */
export function isUtf8(bytes: Uint8Array): boolean {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return false;
  }

  return true;
}
