import { CliError } from '../cli-error.js';
import type { Name } from './name.js';
import { toName } from './to-name.js';

export function parseContextName(input: string): Name {
  const name = toName(input);

  if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name.kebab)) {
    throw new CliError(
      `"${input}" is not a valid context name.`,
      'Name the bounded context in kebab-case after the business capability, for example billing or order-fulfilment.',
    );
  }

  return name;
}
