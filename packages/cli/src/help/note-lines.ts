import type { Note } from './note';

/** The column where the text of every note starts, past its name. */
const TEXT_COLUMN = 19;

/** A note as the reference prints it: its name, then its text from one column, line by line. */
export function noteLines({ name, lines }: Note): string[] {
  const [first = '', ...rest] = lines;

  return [`  ${name.padEnd(TEXT_COLUMN - 2)}${first}`, ...rest.map((line) => `${' '.repeat(TEXT_COLUMN)}${line}`)];
}
