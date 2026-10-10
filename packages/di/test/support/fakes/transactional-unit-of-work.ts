import type { UnitOfWork } from '@ddd-ts-kit/kernel';

/** What takes part in a transaction of the fake unit of work. */
export interface Transactional {
  begin(): void;
  commit(): void;
  rollBack(): void;
}

/**
 * A unit of work as a database gives one: what its participants wrote is kept when the work
 * ends and forgotten when it throws. A run inside a run joins it, as a nested transaction does.
 */
export class TransactionalUnitOfWork implements UnitOfWork {
  /** What became of each transaction, in order. */
  readonly outcomes: ('committed' | 'rolled back')[] = [];

  private depth = 0;

  constructor(
    private readonly participants: readonly Transactional[],
    private readonly whenBegun: () => void = () => {},
  ) {}

  async run<T>(work: () => Promise<T>): Promise<T> {
    if (this.depth > 0) {
      return this.joined(work);
    }

    this.begin();

    try {
      const result = await this.joined(work);

      this.end('committed');

      return result;
    } catch (error) {
      this.end('rolled back');

      throw error;
    }
  }

  private async joined<T>(work: () => Promise<T>): Promise<T> {
    this.depth += 1;

    try {
      return await work();
    } finally {
      this.depth -= 1;
    }
  }

  private begin(): void {
    for (const participant of this.participants) {
      participant.begin();
    }

    this.whenBegun();
  }

  private end(outcome: 'committed' | 'rolled back'): void {
    for (const participant of this.participants) {
      if (outcome === 'committed') {
        participant.commit();
      } else {
        participant.rollBack();
      }
    }

    this.outcomes.push(outcome);
  }
}
