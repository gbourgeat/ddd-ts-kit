/** Where an adapter reaches its executor: `.executor()`, with what follows it up to the end of the statement. */
export interface ExecutorUse {
  readonly offset: number;
  /** The executor is handed to a helper (`insertIgnoringConflict(this.database.executor(), ...)`): the helper confines it. */
  readonly handedOver: boolean;
  /** What follows `.executor()` up to the end of its statement: `.select().from(invoices).where(mine)`. */
  readonly statement: string;
}

const EXECUTOR = /\.executor\s*\(\s*\)/g;

/** Every use of the executor in a source whose literals and comments are blanked. */
export function executorUses(code: string): readonly ExecutorUse[] {
  return [...code.matchAll(EXECUTOR)].map((match) => {
    const after = match.index + match[0].length;
    const end = code.indexOf(';', after);

    return {
      offset: match.index,
      handedOver: /^\s*[,)]/.test(code.slice(after)),
      statement: code.slice(after, end === -1 ? code.length : end),
    };
  });
}
