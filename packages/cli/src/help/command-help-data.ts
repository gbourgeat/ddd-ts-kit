import { NOTES } from './notes';
import { usageLinesOf } from './usage-lines-of';

/** The help of one command as `<command> --help --json` prints it. */
export interface CommandHelpData {
  readonly command: string;
  /** Its usage lines, each starting with `ddd-ts-kit`. */
  readonly usage: readonly string[];
  /** The notes that belong to it, each text on one line. */
  readonly notes: readonly { readonly name: string; readonly text: string }[];
}

/** The help of a command as data; undefined for a command the usage does not name. */
export function commandHelpData(command: string): CommandHelpData | undefined {
  const usage = usageLinesOf(command).map((line) => line.trim());

  if (usage.length === 0) {
    return undefined;
  }

  const notes = NOTES.filter((note) => note.command === command).map(({ name, lines }) => ({
    name,
    text: lines.join(' '),
  }));

  return { command, usage, notes };
}
