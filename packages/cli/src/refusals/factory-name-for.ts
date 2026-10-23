import { VAGUE_REFUSAL_NAMES } from '../generate/errors/vague-refusal-names';
import { toName } from '../naming';

/**
 * The factory name whose code is `code` on the error class of `concept`: the code without the
 * name of the concept at either end (`APPOINTMENT_NOT_FOUND` gives `notFound`), or the whole
 * code when what is left would say nothing.
 */
export function factoryNameFor(code: string, concept: string): string {
  const subject = toName(concept).constant;
  const whole = toName(code).camel;

  const rest = [new RegExp(`^${subject}_`), new RegExp(`_${subject}$`)]
    .filter((edge) => subject !== '' && edge.test(code))
    .map((edge) => toName(code.replace(edge, '')).camel)[0];

  return rest === undefined || rest === '' || VAGUE_REFUSAL_NAMES.includes(rest.toLowerCase()) ? whole : rest;
}
