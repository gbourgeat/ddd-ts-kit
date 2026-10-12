import { CliError } from '../../cli-error.js';
import { toName, type Name } from '../../naming/index.js';
import { VAGUE_REFUSAL_NAMES } from './vague-refusal-names.js';

/** The name of a factory, from `slotTaken`, `slot-taken` or "slot taken": a phrase of the business, never `create` or `error1`. */
export function refusalName(input: string): Name {
  const name = toName(input);

  if (name.camel === '' || !/^[A-Za-z][A-Za-z -]*$/.test(input.trim())) {
    throw new CliError(
      `"${input}" is not the name of a refusal.`,
      'Name it as a domain expert says it, in letters only: slotTaken, alreadyConfirmed, notFound.',
    );
  }

  if (VAGUE_REFUSAL_NAMES.includes(name.camel.toLowerCase())) {
    throw new CliError(
      `"${name.camel}" says that an error is built, not which rule refused.`,
      'Name the refusal as a domain expert says it: slotTaken, alreadyConfirmed, notFound (rule errors/factory-name).',
    );
  }

  return name;
}
