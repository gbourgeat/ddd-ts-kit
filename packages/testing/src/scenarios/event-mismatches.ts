import { isDeepStrictEqual } from 'node:util';
import type { DomainEvent } from '@ddd-ts-kit/kernel';
import { describeEvent } from './describe-event.js';
import type { EventMatcher } from './event-matcher.js';
import { show } from './show.js';

/** Why the event is not the one the matcher describes, one line per difference; none when it is. */
export function eventMismatches(event: DomainEvent, matcher: EventMatcher, where: string): string[] {
  if (typeof matcher === 'string') {
    return matcher === event.name
      ? []
      : [`${where}: expected name ${show(matcher)}, recorded ${show(event.name)}`];
  }

  if (typeof matcher === 'function') {
    return event instanceof matcher
      ? []
      : [`${where}: expected an instance of ${matcher.name}, recorded ${describeEvent(event)}`];
  }

  return subsetDifferences(event, matcher, where);
}

function subsetDifferences(actual: unknown, expected: unknown, path: string): string[] {
  if (isPlainObject(expected) && typeof actual === 'object' && actual !== null) {
    return Object.entries(expected).flatMap(([key, value]) => {
      // Reflect.get rather than a spread: an event class may expose a property through a getter.
      const recorded: unknown = Reflect.get(actual, key);

      return subsetDifferences(recorded, value, `${path}.${key}`);
    });
  }

  return isDeepStrictEqual(actual, expected)
    ? []
    : [`${path}: expected ${show(expected)}, recorded ${show(actual)}`];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const prototype: unknown = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}
