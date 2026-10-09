import type { ContractRunner } from '@ddd-ts-kit/testing/contracts';

export type Awaitable<T> = T | Promise<T>;

type Expectation = ReturnType<ContractRunner['expect']>;

/**
 * A suite of tests about one subject, created anew before each test. The runner is always
 * called as an object, never through functions taken off it, so a runner relying on `this` works.
 */
export abstract class ContractSuite<Subject> {
  #subject: Subject | undefined;

  constructor(
    private readonly runner: ContractRunner,
    private readonly createSubject: () => Awaitable<Subject>,
  ) {}

  describe(name: string): void {
    this.runner.describe(name, () => {
      this.runner.beforeEach(async () => {
        this.#subject = await this.createSubject();
      });
      this.tests();
    });
  }

  protected abstract tests(): void;

  protected it(name: string, test: () => Promise<void>): void {
    this.runner.it(name, test);
  }

  protected expect(actual: unknown): Expectation {
    return this.runner.expect(actual);
  }

  protected get subject(): Subject {
    if (this.#subject === undefined) {
      throw new Error('The subject of a contract suite only exists while a test runs');
    }
    return this.#subject;
  }
}
