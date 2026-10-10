import type { JobCheckpoints } from '../../src/index.js';

export class InMemoryJobCheckpoints implements JobCheckpoints {
  readonly handled = new Map<string, Date>();

  async read(job: string): Promise<Date | undefined> {
    return this.handled.get(job);
  }

  async write(job: string, handled: Date): Promise<void> {
    this.handled.set(job, handled);
  }
}
