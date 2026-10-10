import type { SourceFile } from '../model/source-file.js';

const TYPE_KEY = /(?<![\w$.])type\s*\??\s*:\s*$/;

/** True when the string literal starting at `start` is the value of a `type` key. */
export function isTypeLiteral(file: SourceFile, start: number): boolean {
  return TYPE_KEY.test(file.scan.code.slice(Math.max(0, start - 40), start));
}
