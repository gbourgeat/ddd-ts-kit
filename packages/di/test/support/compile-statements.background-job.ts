import { ok, type BackgroundJob } from '@ddd-ts-kit/kernel';
import { Background } from '@ddd-ts-kit/kernel/declarations';

/** A background job that declares itself, for the specs of discovery. */
export class CompileStatementsJob implements BackgroundJob<{ readonly month: string }> {
  static readonly jobName = 'billing.compile-statements';

  static readonly payload = { parse: (input: unknown) => ok(input) };

  async run(): Promise<void> {
    return undefined;
  }
}

Background()(CompileStatementsJob);
