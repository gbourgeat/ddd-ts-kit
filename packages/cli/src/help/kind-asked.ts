import { kindIn } from '../commands/kind-in';
import type { Kind } from '../generate/kind';

/** The kind a command line of `generate` names, read past the values of its flags; none for another command. */
export function kindAsked([command, ...rest]: readonly string[]): Kind | undefined {
  return command === 'generate' ? kindIn(rest) : undefined;
}
