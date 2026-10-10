import { isOneOf } from '../../config/index.js';
import { CliError } from '../../cli-error.js';

/** The value of a stack flag, checked against what the flag accepts; `undefined` when the flag was not given. */
export function choose<T extends string>(values: readonly T[], value: string | undefined, flag: string): T | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (isOneOf(values, value)) {
    return value;
  }

  throw new CliError(`Unknown value "${value}" for --${flag}.`, `Use one of: ${values.join(', ')}.`);
}
