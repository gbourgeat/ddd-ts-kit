import { InvalidPersonalFieldsError } from './invalid-personal-fields-error';
import type { Retention } from './retention';

/** One unit, a positive whole number of it, counted from a column that is not personal data. */
export function assertRetention<Row>(retention: Retention<Row>, personal: readonly string[]): void {
  const units = [retention.days, retention.months, retention.years].filter((unit) => unit !== undefined);

  if (units.length !== 1 || !units.every((unit) => Number.isInteger(unit) && unit > 0)) {
    throw new InvalidPersonalFieldsError(
      'gives its retention as one unit, days, months or years, a positive whole number of it',
    );
  }

  if (personal.includes(retention.after)) {
    throw new InvalidPersonalFieldsError(
      `counts its retention from "${retention.after}", which it declares personal: a retention runs from a fact of the row, an end or a last activity`,
    );
  }
}
