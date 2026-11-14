import { scan } from '../check/scan/scan';
import { stringAt } from '../check/scan/string-at';

/** One name a statement takes from a module: as the module exports it, and as the statement calls it. */
interface NamedBinding {
  readonly name: string;
  readonly local: string;
}

/** The names one `import { ... } from` or `export { ... } from` takes, and the module it takes them from. */
export interface NamedBindings {
  readonly source: string;
  readonly names: readonly NamedBinding[];
}

/** What a source takes by name from other modules, comments left out: every `import { a, b as c } from` or every `export { a, b as c } from`. */
export function namedBindingsOf(text: string, keyword: 'import' | 'export'): NamedBindings[] {
  const statement = new RegExp(`\\b${keyword}\\s*(?:type\\s+)?\\{([^}]*)\\}\\s*from\\s*`, 'g');

  return [...scan(text).code.matchAll(statement)].flatMap((found) => {
    const source = stringAt(text, found.index + found[0].length);

    return source === undefined ? [] : [{ source, names: bindingsOf(found[1] ?? '') }];
  });
}

function bindingsOf(clause: string): NamedBinding[] {
  return clause
    .split(',')
    .map((part) => part.trim().replace(/^type\s+/, ''))
    .filter((part) => part !== '')
    .map((part) => {
      const [name = '', local = name] = part.split(/\s+as\s+/);

      return { name, local };
    });
}
