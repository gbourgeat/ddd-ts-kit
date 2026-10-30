import { namedOutsideImports } from '../check/scan/named-outside-imports';
import { starExportsOf } from '../check/scan/star-exports-of';

/** Whether a schema index re-exports the file of this name, or names this constant in its code: an import alone does not list a table, nor does a comment. */
export function listedInIndex(
  index: string,
  { file, constant }: { readonly file: string; readonly constant?: string },
): boolean {
  const reexported = starExportsOf(index).some((source) => source.replace(/\.[jt]s$/, '').endsWith(`/${file}`));

  return reexported || (constant !== undefined && namedOutsideImports(index, constant));
}
