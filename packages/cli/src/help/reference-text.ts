import { KINDS } from '../generate/kinds.js';
import { NOTES } from './notes.js';
import { USAGE } from './usage.js';

/** The usage, the notes and the kinds of `generate`: `--help` without its version line, and the reference of docs/guides/commands.md. */
export function referenceText(): string {
  const kinds = KINDS.map(
    (kind) => `  ${kind.usage}${kind.aliases.length > 0 ? `   (alias: ${kind.aliases.join(', ')})` : ''}`,
  );

  return `${USAGE}

${NOTES}

Kinds
${kinds.join('\n')}`;
}
