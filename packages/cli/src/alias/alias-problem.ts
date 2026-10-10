import { FIXED_ALIAS_ROOTS } from './fixed-alias-roots.js';

const SUPPORTED = /^#[a-z][a-z0-9-]*\/$/;

/** Why `importAlias` cannot be honoured by every tool from one declaration, or nothing when it can. */
export function aliasProblem(importAlias: string): string | undefined {
  if (importAlias === '#/') {
    return 'Node 22 refuses a subpath import that starts with "#/", which the kit supports';
  }

  if (!importAlias.startsWith('#')) {
    return 'only a specifier that starts with "#" is a subpath import, which Node, the compiler and every tool of the pipeline resolve from package.json alone; a tsconfig path such as "@/" is unknown to Node, so the compiled output would not run';
  }

  if (!SUPPORTED.test(importAlias)) {
    return 'the alias is "#", one name in lower case (letters, digits, hyphens) and a final "/"';
  }

  const taken = Object.values(FIXED_ALIAS_ROOTS).find(({ prefix }) => prefix === importAlias);

  return taken === undefined ? undefined : `"${importAlias}" already names the directory ${taken.directory}/`;
}
