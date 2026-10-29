import { KINDS } from '../generate/kinds';
import { kindLine } from './kind-line';
import { noteLines } from './note-lines';
import { NOTES } from './notes';
import { USAGE } from './usage';

/** The usage, the notes and the kinds of `generate`: `--help` without its version line, and the reference of docs/guides/commands.md. */
export function referenceText(): string {
  return `${USAGE}

${NOTES.flatMap(noteLines).join('\n')}

Kinds
${KINDS.map((kind) => `  ${kindLine(kind)}`).join('\n')}`;
}
