import type { EventNames } from '../event-names';
import type { Scope } from '../scope';
import { eventFileOf } from './event-file-of';

const DECLARES_ITS_NAME = /\bstatic\s+readonly\s+eventName\s*=|\bextends\s+NamedDomainEvent\s*\(/;

/** True when the event class declares once the name its events carry, `extends NamedDomainEvent('..')` or `static readonly eventName = '..'`. */
export function declaresItsName(scope: Scope, names: EventNames): boolean {
  return DECLARES_ITS_NAME.test(scope.ws.read(eventFileOf(scope, names)) ?? '');
}
