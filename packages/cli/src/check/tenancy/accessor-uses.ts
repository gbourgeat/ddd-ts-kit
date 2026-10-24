/** Where an adapter reaches its executor, client or manager: the accessor call, with what surrounds it in its statement. */
export interface AccessorUse {
  readonly offset: number;
  /** The accessor is handed to a helper (`insertIgnoringConflict(this.database.executor(), ...)`): the helper confines it. */
  readonly handedOver: boolean;
  /** What precedes the accessor in its statement: `return insertIgnoringConflict(this.database` when handed over. */
  readonly before: string;
  /** What follows the accessor up to the end of its statement: `.select().from(invoices).where(mine)`. */
  readonly statement: string;
}

/** Every use of `.<accessor>()` in a source whose literals and comments are blanked. */
export function accessorUses(code: string, accessor: string): readonly AccessorUse[] {
  const calls = new RegExp(`\\.${accessor}\\s*\\(\\s*\\)`, 'g');

  return [...code.matchAll(calls)].map((match) => {
    const after = match.index + match[0].length;
    const end = code.indexOf(';', after);

    return {
      offset: match.index,
      handedOver: /^\s*[,)]/.test(code.slice(after)),
      before: code.slice(statementStart(code, match.index), match.index),
      statement: code.slice(after, end === -1 ? code.length : end),
    };
  });
}

/** Where the statement around `offset` starts: after the previous `;`, `{` or `}`. */
function statementStart(code: string, offset: number): number {
  return Math.max(code.lastIndexOf(';', offset), code.lastIndexOf('{', offset), code.lastIndexOf('}', offset)) + 1;
}
