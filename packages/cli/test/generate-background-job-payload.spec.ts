import { describe, expect, it } from 'vitest';
import { cli, read, write } from './helpers';
import { jobProject } from './support/job-project';

const BILLING = 'src/contexts/billing';
const COMMAND = `${BILLING}/application/commands/remind-invoices/remind-invoices.command.ts`;
const JOB = `${BILLING}/application/background/remind-customer.background-job.ts`;
const SPEC = `${BILLING}/test/unit/remind-customer.background-job.spec.ts`;

const WITH_INPUTS = `import { Command } from '@ddd-ts-kit/kernel';

export class RemindInvoicesCommand extends Command<void> {
  constructor(
    readonly customerId: string,
    readonly dueBefore: Date,
    readonly channel: 'mail' | 'sms',
    readonly invoiceIds: readonly string[],
    readonly limit?: number,
  ) {
    super();
  }
}
`;

const REMIND = [
  'generate',
  'background-job',
  'billing',
  'RemindCustomer',
  '--command',
  'RemindInvoices',
  '--term',
  'Customer=Who is invoiced',
];

/** A project of the stack the flags name, with the job of a command that takes inputs. */
function remindJob(...flags: string[]): string {
  const root = jobProject(...flags);

  write(root, COMMAND, WITH_INPUTS);
  expect(cli(root, ...REMIND).code).toBe(0);

  return root;
}

describe('generate background-job, the schema of its payload', () => {
  it('is the static payload of the class, which the worker reads the stored payload with', () => {
    const job = read(remindJob(), JOB);

    expect(job).toContain("  static readonly jobName = 'billing.remind-customer';\n\n");
    expect(job).toContain('  static readonly payload = payloadSchema;');
  });

  it('is a class of decorated fields without initial value under class-validator, so that a missing field is refused', () => {
    const job = read(remindJob('--validation', 'class-validator'), JOB);

    expect(job).toContain(
      "class RemindCustomerPayloadFields {\n  @IsString()\n  declare customerId: string;\n\n  @IsISO8601()\n  declare dueBefore: string;\n\n  @IsIn(['mail', 'sms'])\n  declare channel: 'mail' | 'sms';\n\n  @IsArray()\n  @IsString({ each: true })\n  declare invoiceIds: string[];\n\n  @IsOptional()\n  @IsNumber()\n  limit?: number;\n}",
    );

    expect(job).toContain('const payloadSchema = classSchema(RemindCustomerPayloadFields);');
    expect(job).toContain('export type RemindCustomerPayload = Infer<typeof payloadSchema>;');
  });

  it('is an object of TypeBox, an instant checked as such', () => {
    const job = read(remindJob('--validation', 'typebox'), JOB);

    expect(job).toContain("    dueBefore: Type.String({ format: 'date-time' }),");
    expect(job).toContain("    channel: Type.Union([Type.Literal('mail'), Type.Literal('sms')]),");
    expect(job).toContain('    limit: Type.Optional(Type.Number()),');
  });

  it('is written by hand under Standard Schema, one refusal per field', () => {
    const job = read(remindJob('--validation', 'standard-schema'), JOB);

    expect(job).toContain('const payloadShape: StandardSchemaV1<unknown, RemindCustomerPayload> = {');
    expect(job).toContain('const payloadSchema = standardSchema(payloadShape);');

    expect(job).toContain(
      "  { path: 'customerId', message: 'A string is expected.', refuses: (sent) => typeof sent.customerId !== 'string' },",
    );

    expect(job).toContain('function fits(sent: object, refused: readonly Refusal[]): sent is RemindCustomerPayload {');
  });

  it('is the schema of the kernel without a validation library', () => {
    const job = read(remindJob('--validation', 'none'), JOB);

    expect(job).toContain('const payloadSchema: BackgroundJobPayloadSchema<RemindCustomerPayload> = {');

    expect(job).toContain(
      "      : err(refused.map(({ path, message }) => ({ path, code: 'invalid_type', message })));",
    );

    expect(job).toContain('function isListOfStrings(value: unknown): value is string[] {');
  });

  it('leaves a type it writes no check for to a TODO, typed unknown so that the type checker stops at it', () => {
    const root = jobProject();

    write(root, COMMAND, WITH_INPUTS.replace('readonly limit?: number,', 'readonly note: string | null,'));
    expect(cli(root, ...REMIND).code).toBe(0);

    expect(read(root, JOB)).toContain(
      '    // TODO(domain): check `note` (string | null) in the schema: the payload a queue kept is read with it before each run.\n    note: z.unknown(),',
    );
  });
});

const OPTIONAL_ONLY = WITH_INPUTS.replace(
  /constructor\([^)]*\)/s,
  'constructor(\n    readonly limit?: number,\n    readonly urgent?: boolean,\n  )',
);

const WITH_UNREAD = WITH_INPUTS.replace('readonly limit?: number,', 'readonly note: string | null,');

/** The job of a command whose constructor is `source`, in a project of the stack the flags name. */
function jobOf(source: string, ...flags: string[]): string {
  const root = jobProject(...flags);

  write(root, COMMAND, source);
  expect(cli(root, ...REMIND).code).toBe(0);

  return read(root, JOB);
}

describe('generate background-job, the schema it writes by hand', () => {
  it.each(['none', 'standard-schema'])(
    'refuses under %s a stored payload that is no object, even when every field is optional',
    (validation) => {
      const job = jobOf(OPTIONAL_ONLY, '--validation', validation);

      expect(job).toContain("if (typeof input !== 'object' || input === null || Array.isArray(input)) {");
      expect(job).toContain('const sent: Readonly<Record<string, unknown>> = { ...input };');
    },
  );

  it.each(['none', 'standard-schema'])(
    'lets under %s a field it writes no check for through as unknown, with its TODO, as the libraries do',
    (validation) => {
      const job = jobOf(WITH_UNREAD, '--validation', validation);

      expect(job).toContain(
        '  // TODO(domain): check `note` (string | null) in the schema: the payload a queue kept is read with it before each run.\n  readonly note: unknown;',
      );

      expect(job).not.toMatch(/path: 'note'|=> true/);
    },
  );

  it('writes the kernel import of a job without a validation library within the width of the formatter', () => {
    const job = jobOf(WITH_INPUTS, '--validation', 'none');

    expect(job.startsWith('import {\n  err,\n  ok,\n  type BackgroundJob,\n  type BackgroundJobExecution,\n')).toBe(
      true,
    );

    expect(job.split('\n').filter((line) => line.length > 120 && !line.trimStart().startsWith('//'))).toEqual([]);
  });
});

describe('the spec generate background-job writes', () => {
  it('enqueues the job as an earlier version typed it and shows the run refused, through the test application', () => {
    const spec = read(remindJob(), SPEC);

    expect(spec).toContain('const earlierVersion = earlierVersionOf(RemindCustomerBackgroundJob);');
    expect(spec).toContain('application.jobQueue.enqueue(earlierVersion, {})');
    expect(spec).toContain("code: 'INVALID_JOB_PAYLOAD',");
    expect(spec).toContain("      { status: 'dead', lastErrorCode: 'INVALID_JOB_PAYLOAD' },");
  });

  it('registers the schema on the worker where the platform is wired by hand, and shows the job dead', () => {
    const spec = read(remindJob('--di', 'manual', '--http', 'express'), SPEC);

    expect(spec).toContain('    payload: RemindCustomerBackgroundJob.payload,');

    expect(spec).toContain(
      "      { job: 'billing.remind-customer', outcome: 'dead', errorCode: 'INVALID_JOB_PAYLOAD' },",
    );
  });
});

describe('generate process, the job of its timeouts', () => {
  it('reads its payload with the schema of the kernel', () => {
    const root = jobProject();

    expect(cli(root, 'generate', 'process', 'billing', 'Dunning', '--term', 'Dunning=Asking again').code).toBe(0);

    expect(read(root, `${BILLING}/application/background/dunning-timeout.background-job.ts`)).toContain(
      '  static readonly payload = processTimeoutDuePayload;',
    );
  });
});
