import type { RenderContext } from '../../templating/index.js';
import type { EventNames } from '../event-names.js';
import { named } from '../named.js';
import type { Scope } from '../scope.js';
import { vars } from '../vars.js';
import { eventNameReference } from './event-name-reference.js';

/** What the templates of a domain event and of its reactions read. */
export function eventVars(scope: Scope, names: EventNames): RenderContext {
  const event = { ...named(names.event), name: names.eventName, reference: eventNameReference(scope, names) };

  return vars(scope, { aggregate: named(names.aggregate), event });
}
