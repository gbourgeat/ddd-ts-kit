import type { RenderContext } from '../../templating';
import type { EventNames } from '../event-names';
import { named } from '../named';
import type { Scope } from '../scope';
import { vars } from '../vars';
import { eventNameReference } from './event-name-reference';

/** What the templates of a domain event and of its reactions read. */
export function eventVars(scope: Scope, names: EventNames): RenderContext {
  const event = {
    ...named(names.event),
    name: names.eventName,
    fact: names.fact.pascal,
    reference: eventNameReference(scope, names),
  };

  return vars(scope, { aggregate: named(names.aggregate), event });
}
