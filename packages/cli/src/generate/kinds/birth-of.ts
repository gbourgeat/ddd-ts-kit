import { toName, type Name } from '../../naming';
import type { Scope } from '../scope';
import type { Birth } from './birth';
import { factoryOf } from './factory-of';

/** The event `create` records, whatever it is given: `created.record(new InvoiceIssued(id, now, customerId))`. */
const RECORDED = /\.record\(new ([A-Z][A-Za-z0-9]*)\(/;

/** The birth read from an existing aggregate: the event it records, none, or why it cannot be read. */
export type ReadBirth = { readonly birth: Birth | undefined } | { readonly unreadable: string };

/**
 * The birth of an existing aggregate, read from its `create` as `generate aggregate --birth` wrote
 * it: the event it records, named after the aggregate and its fact. Unreadable when the aggregate
 * has no `create`, or records there an event named otherwise.
 */
export function birthOf(scope: Scope, aggregate: Name): ReadBirth {
  const file = `${scope.dir}/domain/aggregates/${aggregate.kebab}.aggregate.ts`;
  const factory = factoryOf(scope.ws.read(file) ?? '');

  if (factory === undefined) {
    return { unreadable: `${file} has no \`static create\`, which the builder calls` };
  }

  const event = RECORDED.exec(factory)?.[1];

  if (event === undefined) {
    return { birth: undefined };
  }

  return event.startsWith(aggregate.pascal) && event !== aggregate.pascal
    ? { birth: { event: toName(event), fact: toName(event.slice(aggregate.pascal.length)) } }
    : {
        unreadable: `\`create\` of ${aggregate.pascal} records ${event}, which is not named ${aggregate.pascal}<Fact>`,
      };
}
