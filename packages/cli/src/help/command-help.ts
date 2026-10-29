import { KINDS } from '../generate/kinds';
import { kindLine } from './kind-line';
import { noteLines } from './note-lines';
import { NOTES } from './notes';
import { EVERY_COMMAND } from './usage';
import { usageLinesOf } from './usage-lines-of';

/**
 * What `ddd-ts-kit <command> --help` prints: the usage lines of that command, then the notes that
 * belong to it, and for `generate` the list of its kinds. Undefined for a command the usage does
 * not name, which gets the whole reference.
 */
export function commandHelp(command: string): string | undefined {
  const usage = usageLinesOf(command);

  if (usage.length === 0) {
    return undefined;
  }

  const notes = NOTES.filter((note) => note.command === command).flatMap(noteLines);
  const kinds = command === 'generate' ? ['', 'Kinds', ...KINDS.map((kind) => `  ${kindLine(kind)}`)] : [];

  return ['Usage', ...usage, ...(notes.length > 0 ? ['', ...notes] : []), ...kinds, '', EVERY_COMMAND].join('\n');
}
