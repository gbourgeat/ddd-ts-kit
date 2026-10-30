import type { Knex } from 'knex';
import { UngroupedOrError } from './ungrouped-or-error';

/** What adds an alternative beside the conditions of a statement: `orWhere`, `orWhereIn`, `orHaving`, the `or` modifier. */
const ALTERNATIVE = /^or(?:$|Where|Having)/;

/**
 * The same builder, with the tenant condition held as a conjunct of its statement: an alternative
 * at its top is refused (`UngroupedOrError`), a clone keeps the refusal, and the callback of a
 * `where` stays free, since it writes a group that is and-ed with the condition.
 */
export function conjunctBuilder<Row extends object, Result>(
  builder: Knex.QueryBuilder<Row, Result>,
): Knex.QueryBuilder<Row, Result> {
  return new Proxy(builder, {
    get(target, property, receiver) {
      if (typeof property === 'string' && ALTERNATIVE.test(property)) {
        throw new UngroupedOrError(property);
      }

      return property === 'clone'
        ? (): Knex.QueryBuilder<Row, Result> => conjunctBuilder(target.clone())
        : (Reflect.get(target, property, receiver) as unknown);
    },
  });
}
