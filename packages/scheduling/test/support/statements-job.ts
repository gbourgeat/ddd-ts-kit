import type { BackgroundJob, BackgroundJobExecution } from '@ddd-ts-kit/kernel';

export interface StatementsPayload {
  readonly month: string;
  readonly customers: readonly string[];
}

/** A background job of the specs: it records each run, and a test may hold it in progress or make it fail. */
export class CompileStatementsJob implements BackgroundJob<StatementsPayload> {
  static readonly jobName: string = 'billing.compile-statements';

  readonly runs: { readonly payload: StatementsPayload; readonly execution: BackgroundJobExecution }[] = [];

  failures: Error[] = [];

  private gate: Promise<void> | undefined;

  private openGate: (() => void) | undefined;

  async run(payload: StatementsPayload, execution: BackgroundJobExecution): Promise<void> {
    this.runs.push({ payload, execution });
    await this.gate;

    const failure = this.failures.shift();

    if (failure !== undefined) {
      throw failure;
    }
  }

  hold(): void {
    this.gate = new Promise((resolve) => {
      this.openGate = resolve;
    });
  }

  release(): void {
    this.openGate?.();
    this.gate = undefined;
  }

  /** What the worker registers: this instance, under the name of the class. */
  definition(options: object = {}) {
    return {
      name: CompileStatementsJob.jobName,
      options,
      run: (payload: unknown, execution: BackgroundJobExecution) => this.run(payloadOf(payload), execution),
    };
  }
}

function payloadOf(payload: unknown): StatementsPayload {
  const { month, customers } = Object(payload) as { month: string; customers: string[] };

  return { month, customers };
}
