import type { DomainEvent } from '@ddd-ts-kit/kernel';
import { describeEvent } from './describe-event.js';
import type { EventMatcher } from './event-matcher.js';
import { show } from './show.js';
import { subsetDifferences } from './subset-differences.js';

/** Why the event is not the one the matcher describes, one line per difference; none when it is. */
export function eventMismatches(event: DomainEvent, matcher: EventMatcher, where: string): string[] {
  if (typeof matcher === 'string') {
    return matcher === event.name ? [] : [`${where}: expected name ${show(matcher)}, recorded ${show(event.name)}`];
  }

  if (typeof matcher === 'function') {
    return event instanceof matcher
      ? []
      : [`${where}: expected an instance of ${matcher.name}, recorded ${describeEvent(event)}`];
  }

  return subsetDifferences(event, matcher, where);
}
