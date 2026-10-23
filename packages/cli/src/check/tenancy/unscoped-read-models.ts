import type { SourceFile } from '../model/source-file';
import { balancedArguments } from './balanced-arguments';

/** A read model store of the ORM packages, built with `new` or extended and built with `super`. */
const BUILT = /new\s+(?:Knex|Drizzle)ReadModel(?:Store|Table)\s*(?:<[^()]*>)?\s*\(/g;
const EXTENDED = /extends\s+(?:Knex|Drizzle)ReadModel(?:Store|Table)\b/;
const SUPER = /\bsuper\s*\(/g;

/** The offsets of the read model stores of a file built without the `tenant` option: their rows are shared by every tenant. */
export function unscopedReadModels(file: SourceFile): readonly number[] {
  const { code } = file.scan;
  const built = [...code.matchAll(BUILT)];
  const extended = EXTENDED.test(code) ? [...code.matchAll(SUPER)] : [];

  return [...built, ...extended]
    .filter((match) => !/\btenant\b/.test(balancedArguments(code, match.index + match[0].length - 1)))
    .map((match) => match.index);
}
