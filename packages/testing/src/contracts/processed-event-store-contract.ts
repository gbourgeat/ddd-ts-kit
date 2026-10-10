import type { ProcessedEventStore } from '@ddd-ts-kit/kernel';
import type { Awaitable } from './awaitable.js';
import type { ContractRunner } from './contract-runner.js';
import { ContractSuite } from './contract-suite.js';

export interface ProcessedEventStoreContractOptions {
  readonly name: string;
  /** A fresh, empty store; called before each test. */
  createStore(): Awaitable<ProcessedEventStore>;
}

/** What every adapter of the kernel `ProcessedEventStore` port guarantees, the in-memory one included. */
export function processedEventStoreContract(
  runner: ContractRunner,
  options: ProcessedEventStoreContractOptions,
): void {
  new ProcessedEventStoreSuite(runner, options).describe(
    `${options.name} (processed event store contract)`,
  );
}

class ProcessedEventStoreSuite extends ContractSuite<ProcessedEventStore> {
  constructor(runner: ContractRunner, options: ProcessedEventStoreContractOptions) {
    super(runner, () => options.createStore());
  }

  protected tests(): void {
    this.marksOnce();
    this.keepsMarksApart();
  }

  private marksOnce(): void {
    this.it('says yes the first time an event is seen by a consumer, no afterwards', async () => {
      this.expect(await this.subject.markProcessed('billing', 'evt-1')).toBe(true);
      this.expect(await this.subject.markProcessed('billing', 'evt-1')).toBe(false);
      this.expect(await this.subject.markProcessed('billing', 'evt-1')).toBe(false);
    });

    this.it('says yes to exactly one of several concurrent deliveries', async () => {
      const answers = await Promise.all(
        Array.from({ length: 5 }, () => this.subject.markProcessed('billing', 'evt-1')),
      );

      this.expect(answers.filter((first) => first).length).toBe(1);
    });
  }

  private keepsMarksApart(): void {
    this.it('keeps consumers apart', async () => {
      await this.subject.markProcessed('billing', 'evt-1');

      this.expect(await this.subject.markProcessed('shipping', 'evt-1')).toBe(true);
    });

    this.it('keeps events apart', async () => {
      await this.subject.markProcessed('billing', 'evt-1');

      this.expect(await this.subject.markProcessed('billing', 'evt-2')).toBe(true);
    });

    this.it('does not confuse a separator inside a consumer name or an event id', async () => {
      await this.subject.markProcessed('billing:evt', '1');

      this.expect(await this.subject.markProcessed('billing', 'evt:1')).toBe(true);
    });
  }
}
