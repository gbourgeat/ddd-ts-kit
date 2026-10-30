import { describe, expect, it } from 'vitest';
import { err, type BackgroundJob, type BackgroundJobPayloadSchema } from '@ddd-ts-kit/kernel';
import { earlierVersionOf } from '../src';

const refusingAll: BackgroundJobPayloadSchema<{ readonly month: string }> = {
  parse: () => err([{ path: 'month', code: 'invalid_type', message: 'A month.' }]),
};

class CompileStatementsJob implements BackgroundJob<{ readonly month: string }> {
  static readonly jobName = 'billing.compile-statements';

  static readonly payload = refusingAll;

  async run(): Promise<void> {
    return undefined;
  }
}

describe('a background job as an earlier version declared it', () => {
  it('keeps the name and the class of the job, and reads any payload, which the schema of this version would refuse', () => {
    const earlier = earlierVersionOf(CompileStatementsJob);

    expect([earlier.jobName, earlier.prototype]).toEqual([
      CompileStatementsJob.jobName,
      CompileStatementsJob.prototype,
    ]);

    expect(earlier.payload.parse({ year: 2026 })).toEqual({ ok: true, value: { year: 2026 } });
  });
});
