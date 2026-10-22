import { CliError } from '../../cli-error';
import { parseConceptName, type Name } from '../../naming';
import { VAGUE_REFUSAL_NAMES } from './vague-refusal-names';

/**
 * The name of a refusal class under `"stack.refusals": "named"`, from `InsufficientFunds`,
 * `insufficient-funds` or `InsufficientFundsError`: what is refused, in PascalCase, never ending
 * in `Error`. Its words are judged against the glossary once its code is known (`writeNamedRefusal`).
 */
export function refusalClassName(input: string, allowName: boolean): Name {
  const name = parseConceptName(input, 'refusal', { allowName, strip: ['error'] });

  if (VAGUE_REFUSAL_NAMES.includes(name.camel.toLowerCase()) || name.pascal.endsWith('Error')) {
    throw new CliError(
      `"${input}" says that an error is built, not what is refused.`,
      'Name the class after the refusal, as a domain expert says it: InsufficientFunds, SlotTaken, AppointmentEnded (rule errors/factory-name).',
    );
  }

  return name;
}
