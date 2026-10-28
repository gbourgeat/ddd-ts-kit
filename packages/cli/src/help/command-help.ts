import { KINDS } from '../generate/kinds';
import { kindLine } from './kind-line';
import { NOTES } from './notes';
import { EVERY_COMMAND } from './usage';
import { usageLinesOf } from './usage-lines-of';

/** The column where the text of every note starts, past its name. */
const NOTE_COLUMN = 19;

/** A note of the reference: its name (a command or a flag) and its lines. */
interface Note {
  readonly name: string;
  readonly lines: string[];
}

/**
 * What `ddd-ts-kit <command> --help` prints: the usage lines of that command, then its note and the
 * notes of the flags it takes, and for `generate` the list of its kinds. Undefined for a command the
 * usage does not name, which gets the whole reference.
 */
export function commandHelp(command: string): string | undefined {
  const usage = usageLinesOf(command);

  if (usage.length === 0) {
    return undefined;
  }

  const notes = notesOf(command, usage);
  const kinds = command === 'generate' ? ['', 'Kinds', ...KINDS.map((kind) => `  ${kindLine(kind)}`)] : [];

  return ['Usage', ...usage, ...(notes.length > 0 ? ['', ...notes] : []), ...kinds, '', EVERY_COMMAND].join('\n');
}

/** The note of the command, and the note of each flag its usage names or whose note opens with the command. */
function notesOf(command: string, usage: readonly string[]): string[] {
  const belongs = ({ name, lines }: Note): boolean =>
    name === command ||
    (name.startsWith('--') &&
      (usage.some((line) => new RegExp(`${name}\\b`).test(line)) ||
        (lines[0] ?? '').slice(NOTE_COLUMN).startsWith(`${command} `)));

  return allNotes()
    .filter(belongs)
    .flatMap((note) => note.lines);
}

function allNotes(): Note[] {
  const notes: Note[] = [];

  for (const line of NOTES.split('\n')) {
    const name = /^ {2}(\S+)/.exec(line)?.[1];
    const last = notes.at(-1);

    if (name !== undefined || last === undefined) {
      notes.push({ name: name ?? '', lines: [line] });
    } else {
      last.lines.push(line);
    }
  }

  return notes;
}
