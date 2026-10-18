import { toName } from '../naming/index.js';

/** Parameters that are not what the refusal is about, but how it is told: each has the factory that says so. */
const TOLD: Readonly<Record<string, string>> = { message: 'withMessage', cause: 'becauseOf' };

/**
 * The factory named after what the refusal is about, its first parameter: `appointmentId` gives
 * `forAppointment` (the identifier stands for the thing), `horizon` gives `forHorizon`. A message
 * or a cause gives `withMessage` or `becauseOf`. Undefined without a parameter to name it after.
 */
export function factoryForParameter(parameter: string | undefined): string | undefined {
  if (parameter === undefined) {
    return undefined;
  }

  const subject = toName(parameter).pascal;
  const bare = subject.replace(/Id$/, '');

  return TOLD[parameter] ?? `for${bare === '' ? subject : bare}`;
}
