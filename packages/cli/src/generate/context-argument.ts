import type { Config } from '../config';
import { type Name, readName } from '../naming';

/** The context a command is run in, as the caller typed it: refused when reading it would drop part of it (`../billing`). */
export function contextArgument(config: Config, input: string): Name {
  const known = Object.keys(config.contexts);

  return readName(
    input,
    'context',
    known.length > 0
      ? `Name a context as the config declares it: ${known.join(', ')}.`
      : 'Create one with `ddd-ts-kit generate context <name> --classification <core|supporting|generic>`.',
  );
}
