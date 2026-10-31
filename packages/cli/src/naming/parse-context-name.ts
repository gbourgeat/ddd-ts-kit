import { CliError } from '../cli-error';
import type { Name } from './name';
import { refuseWindowsReserved } from './refuse-windows-reserved';
import { readName } from './read-name';

const FIX =
  'Name the bounded context in kebab-case after the business capability, for example billing or order-fulfilment.';

/** The name of a context as the caller typed it, in kebab-case once read: nothing of it dropped, starting with a letter. */
export function parseContextName(input: string): Name {
  const name = readName(input, 'context', FIX);

  if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name.kebab)) {
    throw new CliError(`"${input}" is not a valid context name.`, FIX);
  }

  refuseWindowsReserved(name, 'context');

  return name;
}
