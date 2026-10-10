import type { IdGenerator } from '../../application/ports/id-generator.js';

export class SequentialIdGenerator implements IdGenerator {
  private n = 0;

  constructor(private readonly prefix = 'id') {}

  next(): string {
    this.n += 1;

    return `${this.prefix}-${this.n}`;
  }
}
