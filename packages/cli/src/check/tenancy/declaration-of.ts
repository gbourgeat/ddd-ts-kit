import { declarationBefore } from './declaration-before';

/** What a local is declared with in the last declaration before `at`, or `undefined` when the file declares none. */
export function declarationOf(code: string, name: string, at: number): string | undefined {
  return declarationBefore(code, name, at)?.text;
}
