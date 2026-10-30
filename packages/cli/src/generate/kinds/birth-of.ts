import { toName, type Name } from '../../naming';
import type { Scope } from '../scope';
import type { Birth } from './birth';

/** What `create` of a generated aggregate records, `created.record(new InvoiceIssued(id, now));`. */
const RECORDED_BIRTH = /\bcreated\.record\(new ([A-Z][A-Za-z0-9]*)\(id, now\)\);/;

/**
 * The birth of an existing aggregate, read from its `create` as `generate aggregate --birth` wrote
 * it: the event it records, named after the aggregate and its fact. Undefined when it records none,
 * or one named otherwise.
 */
export function birthOf(scope: Scope, aggregate: Name): Birth | undefined {
  const source = scope.ws.read(`${scope.dir}/domain/aggregates/${aggregate.kebab}.aggregate.ts`) ?? '';
  const event = RECORDED_BIRTH.exec(source)?.[1];

  if (event === undefined || !event.startsWith(aggregate.pascal) || event === aggregate.pascal) {
    return undefined;
  }

  return { event: toName(event), fact: toName(event.slice(aggregate.pascal.length)) };
}
