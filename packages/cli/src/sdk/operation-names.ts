import { CLIENT_NAMES } from './client-names.js';
import { typeName } from './type-name.js';

/** The words of JavaScript and TypeScript that cannot name a function of a module. */
const RESERVED_WORDS: ReadonlySet<string> = new Set(
  [
    'await break case catch class const continue debugger default delete do else enum export extends false',
    'finally for function if implements import in instanceof interface let new null package private',
    'protected public return static super switch this throw true try typeof var void while with yield',
  ]
    .join(' ')
    .split(' '),
);

/**
 * A name per operation that compiles and clashes with nothing: a reserved word is followed by
 * `Operation` (`deleteOperation`), and a name whose function or types (`<Name>Input`,
 * `<Name>Result`) another operation, a schema or the client itself already holds is followed by a
 * number (`listItems2`).
 */
export function operationNames(names: readonly string[], schemaTypes: ReadonlySet<string>): string[] {
  const taken = new Set<string>();

  return names.map((name) => {
    const base = RESERVED_WORDS.has(name) ? `${name}Operation` : name;
    let unique = base;

    for (let attempt = 2; clashes(unique, taken, schemaTypes); attempt += 1) {
      unique = `${base}${attempt}`;
    }

    taken.add(typeName(unique));

    return unique;
  });
}

function clashes(name: string, taken: ReadonlySet<string>, schemaTypes: ReadonlySet<string>): boolean {
  const prefix = typeName(name);

  return (
    taken.has(prefix) ||
    CLIENT_NAMES.has(name) ||
    [name, `${prefix}Input`, `${prefix}Result`].some((declared) => schemaTypes.has(declared))
  );
}
