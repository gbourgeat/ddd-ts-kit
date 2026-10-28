import fs from 'node:fs';
import { isTypeOnlySource } from './is-type-only-source';

/**
 * Whether a source file declares types only (`isTypeOnlySource`): no spec loads it, so the `v8`
 * provider of Jest counts every line of it as uncovered, though nothing executable is untested.
 */
export function isTypeOnlyFile(file: string): boolean {
  return isTypeOnlySource(fs.readFileSync(file, 'utf8'));
}
