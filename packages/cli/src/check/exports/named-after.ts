import { kebabCaseOf } from './kebab-case-of.js';

/**
 * True when a file whose base name, extension aside, is `stem` is named after `name`: the stem with
 * every dot read as a hyphen is its kebab-case; or, in a role file, the part before the first dot
 * is, unless the name already ends with the role (`invoice.aggregate` for `Invoice`).
 */
export function namedAfter(stem: string, name: string): boolean {
  const kebab = kebabCaseOf(name);

  if (stem.replaceAll('.', '-') === kebab) {
    return true;
  }

  const parts = stem.split('.');

  return parts.length > 1 && parts[0] === kebab && !kebab.endsWith(`-${parts.at(-1) ?? ''}`);
}
