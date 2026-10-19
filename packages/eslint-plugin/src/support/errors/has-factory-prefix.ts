/** The words a factory of a named refusal starts with: what the refusal is about, `forAccountId`, `becauseOf`. */
const PREFIXED = /^(for|with|because|on|at)[A-Z]/;

/** `forCalendar` and `atStart` carry a prefix; `slotTaken`, `format` and `onboard` do not. */
export function hasFactoryPrefix(name: string): boolean {
  return PREFIXED.test(name);
}
