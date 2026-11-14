import { scan } from '../check/scan/scan';
import { starExportsOf } from '../check/scan/star-exports-of';
import { escapeRegExp } from '../check/text/escape-reg-exp';
import { fileOfSource } from './file-of-source';
import { namedBindingsOf } from './named-bindings-of';

/** A constant a tables file exports, and whether the tables file of another context the index re-exports whole exports one of that name. */
interface Reexported {
  readonly file: string;
  readonly constant: string;
  readonly sharesItsName: boolean;
}

/**
 * Whether a schema index that re-exports a tables file whole still hides one of its constants: the
 * index declares a constant of that name, exports one by name from another file, or re-exports
 * whole another tables file that holds one, and no line exports this one by name. What reads the
 * index then finds another table under that name, or none.
 */
export function hiddenInIndex(index: string, { file, constant, sharesItsName }: Reexported): boolean {
  const named = namedBindingsOf(index, 'export');
  const own = named.filter(({ source }) => fileOfSource(source) === file);
  const others = named.filter(({ source }) => fileOfSource(source) !== file);

  if (
    !starExportsOf(index).some((source) => fileOfSource(source) === file) ||
    own.some(({ names }) => names.some(({ name }) => name === constant))
  ) {
    return false;
  }

  const isDeclared = new RegExp(`^export const ${escapeRegExp(constant)}\\b`, 'm').test(scan(index).code);

  return sharesItsName || isDeclared || others.some(({ names }) => names.some(({ local }) => local === constant));
}
