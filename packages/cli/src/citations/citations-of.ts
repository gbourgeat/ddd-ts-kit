import type { CitedName } from './cited-name';
import type { CitedPart } from './cited-parts';

/** One cited name of one line of a document, with every row and context of the parts it lies in. */
export interface Citation {
  readonly name: CitedName;
  readonly document: string;
  readonly rows: readonly string[];
  readonly contexts: readonly string[];
  /** Every name cited by those parts: a successor cited there means the design already took the change in. */
  readonly neighbours: ReadonlySet<string>;
}

/** The citations of some parts, each once: a line in a section and in its whole document is one citation of both. */
export function citationsOf(cited: readonly CitedPart[]): Citation[] {
  const merged = new Map<string, Citation>();

  for (const { part, contexts, names } of cited) {
    const neighbours = new Set(names.map((name) => name.cited));

    for (const name of names) {
      const key = `${part.document}:${name.line}:${name.cited}`;
      const known = merged.get(key);

      merged.set(
        key,
        known === undefined
          ? { name, document: part.document, rows: part.rows, contexts, neighbours }
          : {
              ...known,
              rows: [...new Set([...known.rows, ...part.rows])],
              contexts: [...new Set([...known.contexts, ...contexts])],
              neighbours: new Set([...known.neighbours, ...neighbours]),
            },
      );
    }
  }

  return [...merged.values()];
}
