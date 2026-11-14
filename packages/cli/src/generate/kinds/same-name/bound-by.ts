const NAMED_IMPORT = /^[ \t]*import \{([^}]*)\} from '([^']+)';\n/gm;

/** One name an import statement of the index binds, with the statement that binds it. */
export interface Bound {
  readonly statement: string;
  readonly source: string;
  readonly name: string;
  readonly local: string;
  /** The entity it binds: the file its module resolves to, else the module as written, and the name imported there. */
  readonly entity: string;
  /** The file its module resolves to, when it resolves to one. */
  readonly file?: string;
  /** Whether that file is the tables file of a context that declares the name itself: only such imports are told apart. */
  readonly told: boolean;
  /** The other names the statement binds, as written. */
  readonly others: readonly string[];
}

/** The entity an import binds, from its module and the name it imports there. */
export type EntityOf = (source: string, name: string) => Pick<Bound, 'entity' | 'file' | 'told'>;

/** Every name the import statements of the index bind, in order, each statement written on one line or several. */
export function boundBy(index: string, entityOf: EntityOf): Bound[] {
  return [...index.matchAll(NAMED_IMPORT)].flatMap(([statement, clause = '', source = '']) => {
    const written = clause
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part !== '');

    return written.map((part) => {
      const [name = '', local = name] = part.split(/\s+as\s+/);

      return {
        statement,
        source,
        name,
        local,
        ...entityOf(source, name),
        others: written.filter((other) => other !== part),
      };
    });
  });
}
