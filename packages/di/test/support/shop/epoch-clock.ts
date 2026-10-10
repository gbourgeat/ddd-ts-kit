import type { Clock } from '@ddd-ts-kit/kernel';

export class EpochClock implements Clock {
  now(): Date {
    return new Date(0);
  }
}
