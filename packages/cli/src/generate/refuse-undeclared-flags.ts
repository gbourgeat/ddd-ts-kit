import { CliError } from '../cli-error';
import type { Kind } from './kind';
import { usageOf } from './usage-of';

/** The flags of `generate` that every kind takes, whatever its usage shows. */
const EVERY_KIND = ['allow-name', 'local-only', 'dry-run', 'force'];

/** Why a kind refuses a flag another kind takes, when more than "it reads no such flag" is worth saying. */
const REASONS: Readonly<Record<string, string>> = {
  term: 'what this kind names exists already or is not held to the glossary; give --term to the kind that names the concept first, or add the row to the "## Ubiquitous language" table of the CONTEXT.md',
};

/**
 * Refuses a flag the usage of the kind does not show: `generate` parses the flags of every kind
 * at once, and a kind reads only its own, so that flag would otherwise be ignored without a word.
 * A flag no kind takes is refused earlier, by the parser of the arguments.
 */
export function refuseUndeclaredFlags(kind: Kind, passed: readonly string[]): void {
  const usage = usageOf(kind);
  const taken = new Set([...EVERY_KIND, ...[...usage.matchAll(/--([a-z-]+)/g)].map((match) => match[1])]);
  const refused = passed.filter((flag) => !taken.has(flag));
  const [first] = refused;

  if (first === undefined) {
    return;
  }

  const reasons = refused.flatMap((flag) => {
    const reason = REASONS[flag];

    return reason === undefined ? [] : [`--${flag}: ${reason}.`];
  });

  throw new CliError(
    `generate ${kind.name} does not take ${refused.map((flag) => `--${flag}`).join(', ')}: it would be ignored.`,
    [...reasons, `Run it again without it. Usage: ddd-ts-kit generate ${usage}`].join(' '),
  );
}
