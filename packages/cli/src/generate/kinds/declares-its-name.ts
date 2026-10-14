import type { EventNames } from '../event-names.js';
import type { Scope } from '../scope.js';
import { eventFileOf } from './event-file-of.js';

const DECLARES_ITS_NAME = /\bstatic\s+readonly\s+eventName\s*=/;

/** True when the event class declares once the name its events carry, `static readonly eventName = '..'`. */
export function declaresItsName(scope: Scope, names: EventNames): boolean {
  return DECLARES_ITS_NAME.test(scope.ws.read(eventFileOf(scope, names)) ?? '');
}
