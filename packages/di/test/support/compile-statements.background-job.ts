import type { BackgroundJob } from '@ddd-ts-kit/kernel';
import { Background } from '@ddd-ts-kit/kernel/declarations';

/** A background job that declares itself, for the specs of discovery. */
export class CompileStatementsJob implements BackgroundJob<{ readonly month: string }> {
  static readonly jobName = 'billing.compile-statements';

  async run(): Promise<void> {
    return undefined;
  }
}

Background()(CompileStatementsJob);
