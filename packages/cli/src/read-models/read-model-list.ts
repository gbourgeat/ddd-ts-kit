import type { ImportTarget } from '../check/model/import-target';

/** An entry of `LISTED`, `['<context>', <Store>]`. */
export interface ListedEntry {
  readonly context: string;
  /** The class as the list names it: an import, under an alias or not, or a class the list declares. */
  readonly local: string;
  readonly line: number;
}

/** A store `NOT_LISTED` names, `'<context>: <Store>'`. */
export interface NamedStore {
  readonly context: string;
  readonly store: string;
  readonly line: number;
}

/** A class the list imports by name. */
export interface ImportedClass {
  /** Its name in the file that declares it. */
  readonly name: string;
  readonly target: ImportTarget;
}

/** What `<platformDir>/database/read-model-tables.ts` says, read from its text. */
export interface ReadModelList {
  readonly file: string;
  /**
   * The line of what cannot be read with certainty: `LISTED` when it is not an array written in
   * the file, or the first thing it holds that is not `['<context>', <Store>]`. None: every
   * entry was read.
   */
  readonly unread: number | undefined;
  readonly entries: readonly ListedEntry[];
  readonly notListed: readonly NamedStore[];
  /** The classes the file imports by name, by the name it gives them. */
  readonly imports: ReadonlyMap<string, ImportedClass>;
  /** The text of each comment of the file. */
  readonly comments: readonly string[];
}
