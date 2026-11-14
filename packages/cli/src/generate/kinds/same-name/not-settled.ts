/** What kept the kit from writing names in the schema index, and the lines it would have written. */
interface NotSettled {
  readonly index: string;
  /** Why, as the end of "nothing written: ...". */
  readonly because: string;
  /** The lines it would have written. */
  readonly lines: readonly string[];
}

/**
 * The sentence of a settle that wrote nothing, said once per command. A line written on a reading
 * that is not certain could hide a table, the index still compiling: nothing is written, the index
 * stays as the command left it, and the team gets why, with the lines to write by hand.
 */
export function notSettled({ index, because, lines }: NotSettled): string {
  const byHand =
    lines.length === 0
      ? ''
      : ` To write by hand, after its \`export *\` lines:\n${lines.map((line) => `  ${line}`).join('\n')}`;

  return `${index}: the kit wrote no name in it: ${because}.${byHand}`;
}
