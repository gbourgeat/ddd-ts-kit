import { randomUUID } from 'node:crypto';
import type { Clock, IdGenerator } from '../application/ports.js';

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export class FixedClock implements Clock {
  constructor(private current: Date) {}
  now(): Date {
    return this.current;
  }
  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}

export class UuidGenerator implements IdGenerator {
  next(): string {
    return randomUUID();
  }
}

export class SequentialIdGenerator implements IdGenerator {
  #n = 0;
  constructor(private readonly prefix = 'id') {}
  next(): string {
    this.#n += 1;
    return `${this.prefix}-${this.#n}`;
  }
}
