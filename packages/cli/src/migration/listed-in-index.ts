import { namedOutsideImports } from '../check/scan/named-outside-imports';
import { starExportsOf } from '../check/scan/star-exports-of';
import { fileOfSource } from './file-of-source';
import { namedBindingsOf } from './named-bindings-of';

/** What a schema index is asked about: the tables file, the constant it exports, the context that holds it. */
interface Listed {
  readonly file: string;
  readonly constant?: string;
  /** Whether a module the index imports from is a file of the context that holds the tables file. */
  readonly isOfItsContext?: (source: string) => boolean;
}

/**
 * Whether a schema index re-exports the file of this name, or names this constant in its code: an
 * import alone does not list a table, nor does a comment. A constant the index imports from the
 * file of this name, from another file of its context or from a barrel a team wrote for it, is
 * read under the name the import gives it, `orders as billingOrders`; one it imports only from the
 * tables file of another context is the table of that context, which bears the same name, and
 * lists nothing of this file.
 */
export function listedInIndex(index: string, { file, constant, isOfItsContext }: Listed): boolean {
  if (starExportsOf(index).some((source) => fileOfSource(source) === file)) {
    return true;
  }

  if (constant === undefined) {
    return false;
  }

  const isOwn = (source: string): boolean => fileOfSource(source) === file || isOfItsContext?.(source) === true;

  const imported = namedBindingsOf(index, 'import').flatMap(({ source, names }) =>
    names.filter(({ name }) => name === constant).map(({ local }) => ({ source, local })),
  );

  const own = imported.filter(({ source }) => isOwn(source));
  const ofAnotherContext = imported.some(({ source }) => !isOwn(source) && fileOfSource(source).endsWith('.schema'));

  if (own.length === 0 && ofAnotherContext) {
    return false;
  }

  return (own.length === 0 ? [constant] : own.map(({ local }) => local)).some((local) =>
    namedOutsideImports(index, local),
  );
}
