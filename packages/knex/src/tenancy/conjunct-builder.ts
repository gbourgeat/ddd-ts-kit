import type { Knex } from 'knex';
import { ClearedTenantConditionError } from './cleared-tenant-condition-error';
import { UngroupedOrError } from './ungrouped-or-error';

/** What adds an alternative beside the conditions of a statement: `orWhere`, `orWhereIn`, the `or` modifier. `orHaving` applies after the where, and is free. */
const ALTERNATIVE = /^or(?:$|Where)/;

const WHERE = new Set(['where', 'andWhere']);
const WHERE_RAW = new Set(['whereRaw', 'andWhereRaw']);

type Call = (...args: readonly unknown[]) => unknown;

/**
 * The same builder, with the tenant condition held as a conjunct of its statement: an alternative
 * at its top is refused (`UngroupedOrError`), and so is clearing its conditions
 * (`ClearedTenantConditionError`); raw text given to a where is one parenthesised conjunct, with
 * its bindings. A clone keeps all of it, and the callback of a `where` stays free, since it
 * writes a group that is and-ed with the condition.
 */
export function conjunctBuilder<Row extends object, Result>(
  builder: Knex.QueryBuilder<Row, Result>,
): Knex.QueryBuilder<Row, Result> {
  return new Proxy(builder, {
    get(target, property, receiver: unknown) {
      if (typeof property === 'string' && ALTERNATIVE.test(property)) {
        throw new UngroupedOrError(property);
      }

      if (property === 'clearWhere') {
        throw new ClearedTenantConditionError(property);
      }

      if (property === 'clone') {
        return (): Knex.QueryBuilder<Row, Result> => conjunctBuilder(target.clone());
      }

      const member = Reflect.get(target, property, receiver) as unknown;

      return typeof property === 'string' ? held(member, property, receiver) : member;
    },
  });
}

/** The member a statement answers: a where that keeps raw text in parentheses, a clear that keeps the conditions, or the member itself. */
function held(call: unknown, property: string, receiver: unknown): unknown {
  if (!isCall(call)) {
    return call;
  }

  if (WHERE.has(property)) {
    return (...args: readonly unknown[]) => call.apply(receiver, args.map(parenthesised));
  }

  if (WHERE_RAW.has(property)) {
    return (sql: unknown, ...bindings: readonly unknown[]) =>
      call.apply(receiver, [typeof sql === 'string' ? `(${sql})` : parenthesised(sql), ...bindings]);
  }

  if (property === 'clear') {
    return (statement: unknown) => {
      if (statement === 'where') {
        throw new ClearedTenantConditionError(`clear('where')`);
      }

      return call.call(receiver, statement);
    };
  }

  return call;
}

/** A `knex.raw` kept in parentheses, whatever it says. `wrap` answers the same text however many times it is called. */
function parenthesised(value: unknown): unknown {
  return isRaw(value) ? value.wrap('(', ')') : value;
}

function isCall(value: unknown): value is Call {
  return typeof value === 'function';
}

function isRaw(value: unknown): value is Knex.Raw {
  return typeof value === 'object' && value !== null && 'isRawInstance' in value;
}
