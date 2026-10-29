import { CliError } from '../cli-error';
import type { Config } from '../config';
import { ownEntry } from '../config/values/own-entry';

/** The name of a declared context, or the error every command gives for a name the config does not know. */
export function knownContext(config: Config, name: string | undefined): string {
  if (name !== undefined && ownEntry(config.contexts, name) !== undefined) {
    return name;
  }

  const known = Object.keys(config.contexts);

  const use =
    known.length > 0
      ? `Use one of: ${known.join(', ')}.`
      : 'Create one with `ddd-ts-kit generate context <name> --classification <core|supporting|generic>`.';

  throw new CliError(name === undefined ? 'A context name is expected.' : `Unknown context "${name}".`, use);
}
