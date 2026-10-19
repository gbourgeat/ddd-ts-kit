import { KIT_ERROR_CODES } from '../../check/errors/kit-error-codes.js';
import { CliError } from '../../cli-error.js';
import { toName, type Name } from '../../naming/index.js';

interface Naming {
  readonly concept: Name;
  readonly refusal: Name;
}

/**
 * The code a factory sets: its name in constant case, with the name of the concept before it
 * when the name alone is one word or a code of the kit (`AppointmentError.notFound` sets
 * `APPOINTMENT_NOT_FOUND`). A code given with `--code` is one of the forms `errors/factory-name` accepts.
 */
export function refusalCode({ concept, refusal }: Naming, asked: string | undefined): string {
  const alone = refusal.constant;
  const accepted = [alone, `${concept.constant}_${alone}`, `${alone}_${concept.constant}`];

  if (asked === undefined) {
    return alone.includes('_') && !KIT_ERROR_CODES.includes(alone) ? alone : `${concept.constant}_${alone}`;
  }

  if (!accepted.includes(asked)) {
    throw new CliError(
      `The code "${asked}" does not say what ${concept.pascal}Error.${refusal.camel} says.`,
      `Use one of: ${accepted.join(', ')}; or name the refusal after the code${namedAfter(concept, asked)} (rule errors/factory-name).`,
    );
  }

  return asked;
}

/** The refusal a code says, the concept around it left out: `NIGHTS_NOT_APPLICABLE` of `Stay` is `nightsNotApplicable`. */
function namedAfter(concept: Name, code: string): string {
  const said = code.replace(new RegExp(`^${concept.constant}_|_${concept.constant}$`), '');
  const refusal = toName(said).camel;

  return refusal === '' ? '' : `: ${concept.pascal} ${refusal}`;
}
