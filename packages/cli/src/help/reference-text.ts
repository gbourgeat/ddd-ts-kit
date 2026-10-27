import { KINDS } from '../generate/kinds';
import { usageOf } from '../generate/usage-of';
import { NOTES } from './notes';
import { USAGE } from './usage';

/** The usage, the notes and the kinds of `generate`: `--help` without its version line, and the reference of docs/guides/commands.md. */
export function referenceText(): string {
  const kinds = KINDS.map(
    (kind) => `  ${usageOf(kind)}${kind.aliases.length > 0 ? `   (alias: ${kind.aliases.join(', ')})` : ''}`,
  );

  return `${USAGE}

${NOTES}

Kinds
${kinds.join('\n')}`;
}
