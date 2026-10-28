import { findKind } from '../generate/find-kind';
import type { Kind } from '../generate/kind';

/** The kind named after `generate` (or `g`): its first argument that is not a flag. */
export function kindAsked([command, ...rest]: readonly string[]): Kind | undefined {
  const name = rest.find((argument) => !argument.startsWith('-'));

  return (command === 'generate' || command === 'g') && name !== undefined ? findKind(name) : undefined;
}
