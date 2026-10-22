import type { Awaitable } from './awaitable';
import type { ContractRunner } from './contract-runner';

type Expectation = ReturnType<ContractRunner['expect']>;

/**
 * The base of a contract suite: tests about one subject, created anew before each test. A
 * package holding a port extends it to publish the contract of that port. The runner is
 * always called as an object, never through functions taken off it, so a runner that relies
 * on `this` works too.
 */
export abstract class ContractSuite<Subject> {
  private subjectOfTheTest: Subject | undefined;

  constructor(
    private readonly runner: ContractRunner,
    private readonly createSubject: () => Awaitable<Subject>,
  ) {}

  describe(name: string): void {
    this.runner.describe(name, () => {
      this.runner.beforeEach(async () => {
        this.subjectOfTheTest = await this.createSubject();
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

  protected afterEach(teardown: () => Promise<void>): void {
    this.runner.afterEach?.(teardown);
  }

  protected get subject(): Subject {
    if (this.subjectOfTheTest === undefined) {
      throw new Error('The subject of a contract suite only exists while a test runs');
    }

    return this.subjectOfTheTest;
  }
}
