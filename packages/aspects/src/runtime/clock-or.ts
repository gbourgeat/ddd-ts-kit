import { SystemClock, type Clock } from '@ddd-ts-kit/kernel';
import { currentRuntime } from './installed-runtime.js';

const systemClock = new SystemClock();

export function clockOr(given: Clock | undefined): Clock {
  return given ?? currentRuntime().clock ?? systemClock;
}
