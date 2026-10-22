import { FIXED_ALIAS_ROOTS } from './fixed-alias-roots';

const SUPPORTED = /^(?:@|\$[a-z][a-z0-9-]*)\/$/;
const SCOPED = /^@[^/]+\/$/;

/** Why `importAlias` cannot be honoured by every tool from one declaration, or nothing when it can. */
export function aliasProblem(importAlias: string): string | undefined {
  if (importAlias.startsWith('#')) {
    return 'a specifier that starts with "#" is a Node subpath import, declared in package.json and resolved by Node itself; the kit declares the alias under "paths" in tsconfig.json and rewrites it when it builds';
  }

  if (SCOPED.test(importAlias)) {
    return 'it is also how the packages of a scope are named, and dependency-cruiser resolves an installed package before the project; "@/" has no scope name and "$<name>/" holds a character no package name may hold';
  }

  if (!SUPPORTED.test(importAlias)) {
    return 'the alias is "@/", or "$", one name in lower case (letters, digits, hyphens) and a final "/": the two forms that can never be the name of a package';
  }

  const taken = Object.values(FIXED_ALIAS_ROOTS).find(({ prefix }) => prefix === importAlias);

  return taken === undefined ? undefined : `"${importAlias}" already names the directory ${taken.directory}/`;
}
