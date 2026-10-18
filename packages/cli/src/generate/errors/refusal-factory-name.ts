import { CliError } from '../../cli-error.js';
import { toName, type Name } from '../../naming/index.js';
import { FACTORY_PREFIX } from './factory-prefix.js';

/** The name of a factory of a refusal class, from `forAccountId`, `for-account-id` or "for account id"; letters only. */
export function refusalFactoryName(input: string): Name {
  const name = toName(input);

  if (name.camel === '' || !/^[A-Za-z][A-Za-z -]*$/.test(input.trim())) {
    throw new CliError(
      `"${input}" is not the name of a factory.`,
      'Name it after what the refusal is about, in letters only: forAccountId, withNotice, becauseOf (rule errors/factory-name).',
    );
  }

  if (!FACTORY_PREFIX.test(name.camel)) {
    throw new CliError(
      `"${name.camel}" does not say what the refusal is about.`,
      `Start it with for, with, because, on or at: for${name.pascal} (rule errors/factory-name).`,
    );
  }

  return name;
}
