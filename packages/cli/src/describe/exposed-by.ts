import { wholeLiteral } from '../check/declarations/whole-literal.js';
import type { Scan } from '../check/scan/scan.js';
import { callArguments } from '../check/text/call-arguments.js';

const EXPOSING = /\.\s*exposing\s*\(/g;

/** The facts a factory lets a client read: the literal names of the `.exposing(..)` calls between `open` and `end`. */
export function exposedBy(scanned: Scan, { open, end }: { readonly open: number; readonly end: number }): string[] {
  return [...scanned.code.matchAll(EXPOSING)]
    .filter((match) => match.index > open && match.index < end)
    .flatMap((match) => callArguments(scanned.code, match.index + match[0].length - 1))
    .flatMap((argument) => wholeLiteral(scanned, argument) ?? []);
}
