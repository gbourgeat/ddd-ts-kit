import {
  err,
  ok,
  type BackgroundJob,
  type BackgroundJobExecution,
  type BackgroundJobPayloadSchema,
} from '@ddd-ts-kit/kernel';

export interface StatementsPayload {
  readonly month: string;
  readonly customers: readonly string[];
}

/** The schema of the specs, written by hand as a project without a validation library would: a month and a list of customers. */
export const statementsPayload: BackgroundJobPayloadSchema<StatementsPayload> = {
  parse(input) {
    const { month, customers } = Object(input) as { month?: unknown; customers?: unknown };

    if (typeof month !== 'string') {
      return err([{ path: 'month', code: 'invalid_type', message: 'A month is expected.' }]);
    }

    if (!Array.isArray(customers) || !customers.every((customer) => typeof customer === 'string')) {
      return err([{ path: 'customers', code: 'invalid_type', message: 'A list of customer ids is expected.' }]);
    }

    return ok({ month, customers });
  },
};

/** A background job of the specs: it records each run, and a test may hold it in progress or make it fail. */
export class CompileStatementsJob implements BackgroundJob<StatementsPayload> {
  static readonly jobName: string = 'billing.compile-statements';

  static readonly payload = statementsPayload;

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
      payload: statementsPayload,
      run: (payload: unknown, execution: BackgroundJobExecution) => this.run(payloadOf(payload), execution),
    };
  }
}

/** The worker hands the payload as the schema read it. */
function payloadOf(payload: unknown): StatementsPayload {
  const { month, customers } = Object(payload) as { month: string; customers: string[] };

  return { month, customers };
}
