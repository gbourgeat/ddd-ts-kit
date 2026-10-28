import { usageOf } from '../generate/usage-of';
import { kindAsked } from './kind-asked';
import { usageLinesOf } from './usage-lines-of';

/**
 * The usage a refused argument is answered with, unindented: the line of the kind under
 * `generate <kind>`, else the lines of the command; undefined for a command the usage does not name.
 */
export function usageFor(argv: readonly string[]): string | undefined {
  const kind = kindAsked(argv);

  if (kind !== undefined) {
    return `ddd-ts-kit generate ${usageOf(kind)}`;
  }

  const lines = usageLinesOf(argv[0] === 'g' ? 'generate' : (argv[0] ?? '')).map((line) => line.trim());

  return lines.length > 0 ? lines.join('\n') : undefined;
}
