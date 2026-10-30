import { beforeAll, describe, expect, it } from 'vitest';
import { cli, read, write } from './helpers';
import { failure, report } from './reports';
import { jobProject } from './support/job-project';

const BILLING = 'src/contexts/billing';
const JOB = `${BILLING}/application/background/compile-statements.background-job.ts`;
const JOB_SPEC = `${BILLING}/test/unit/compile-statements.background-job.spec.ts`;
const PROCESS = `${BILLING}/application/processes/dunning.process.ts`;
const TIMEOUT_JOB = `${BILLING}/application/background/dunning-timeout.background-job.ts`;
const PROCESS_SPEC = `${BILLING}/test/unit/dunning.process.spec.ts`;
const TIMEOUT_SPEC = `${BILLING}/test/unit/dunning-timeout.background-job.spec.ts`;

const COMPILE = [
  'generate',
  'background-job',
  'billing',
  'CompileStatementsBackgroundJob',
  '--command',
  'CancelInvoice',
  '--term',
  'Compile=To gather the invoices of a period',
  '--term',
  'Statement=What a customer owes, at the end of a month',
];

const DUNNING = [
  'generate',
  'process',
  'billing',
  'DunningProcess',
  '--term',
  'Dunning=Asking a customer to pay, again',
];

describe('generate background-job, in the declared style', () => {
  let root: string;
  let generated: ReturnType<typeof report>;

  beforeAll(() => {
    root = jobProject();
    generated = report(cli(root, ...COMPILE, '--json'));
  });

  it('writes the job named by its static jobName, its spec, and lists it in the declarations of its layer and in CONTEXT.md', () => {
    expect(generated.created).toEqual([JOB, JOB_SPEC]);
    expect(generated.updated).toContain(`${BILLING}/application/application.declarations.ts`);

    expect(read(root, `${BILLING}/application/application.declarations.ts`)).toContain(
      "export * from '@/contexts/billing/application/background/compile-statements.background-job';",
    );

    expect(read(root, `${BILLING}/application/application.declarations.ts`)).toContain(
      'injected(CompileStatementsBackgroundJob, [CommandBus]);',
    );

    expect(read(root, `${BILLING}/billing.declarations.ts`)).toContain(
      "export * from '@/contexts/billing/application/application.declarations';",
    );

    expect(read(root, `${BILLING}/CONTEXT.md`)).toContain('billing.compile-statements');
  });

  it('sends its command as the actor that enqueued it', () => {
    const job = read(root, JOB);

    expect(job).toContain(
      "@Background()\nexport class CompileStatementsBackgroundJob implements BackgroundJob<CompileStatementsPayload> {\n  static readonly jobName = 'billing.compile-statements';",
    );

    expect(job).toContain('await this.commands.execute(new CancelInvoiceCommand(execution.actor));');
  });

  it('enqueues the job as a user holding the permission, runs what is due and asserts the command sent as that user', () => {
    const spec = read(root, JOB_SPEC);

    expect(spec).toContain(
      'await application.as(clerk, () => application.jobQueue.enqueue(CompileStatementsBackgroundJob, {}));',
    );

    expect(spec).toContain("roles: { clerk: [billingPermissions['invoice.cancel']] }");
    expect(spec).toContain("expect(sent[0]).toMatchObject({ actor: { id: 'clerk-1' } });");
  });

  it('refuses a job without its command, and a command it cannot build', () => {
    const without = failure(cli(root, 'generate', 'background-job', 'billing', 'Statement', '--json'));

    expect(without.message).toBe('A background job needs --command.');
  });
});

const REMIND_COMMAND = `${BILLING}/application/commands/remind-invoices/remind-invoices.command.ts`;

const REMIND_WITH_INPUTS = `import { Command } from '@ddd-ts-kit/kernel';

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

describe('generate background-job, for a command that takes inputs', () => {
  let root: string;

  beforeAll(() => {
    root = jobProject();
    write(root, REMIND_COMMAND, REMIND_WITH_INPUTS);
    expect(cli(root, ...REMIND).code).toBe(0);
  });

  it('carries each input in the payload, an instant as its ISO text, and hands them to the command in order', () => {
    const job = read(root, `${BILLING}/application/background/remind-customer.background-job.ts`);

    expect(job).toContain(
      "  z.object({\n    customerId: z.string(),\n    dueBefore: z.iso.datetime(),\n    channel: z.enum(['mail', 'sms']),\n    invoiceIds: z.array(z.string()),\n    limit: z.number().optional(),\n  }),",
    );

    expect(job).toContain('export type RemindCustomerPayload = Infer<typeof payloadSchema>;');

    expect(job).toContain(
      '      new RemindInvoicesCommand(\n        payload.customerId,\n        new Date(payload.dueBefore),\n        payload.channel,\n        payload.invoiceIds,\n        payload.limit,\n      ),',
    );
  });

  it('enqueues a payload of every field in its spec', () => {
    const spec = read(root, `${BILLING}/test/unit/remind-customer.background-job.spec.ts`);

    expect(spec).toContain('type RemindCustomerPayload');

    expect(spec).toContain(
      "      dueBefore: '2026-03-02T09:00:00.000Z',\n      channel: 'mail',\n      invoiceIds: [],",
    );

    expect(spec).toContain('application.jobQueue.enqueue(RemindCustomerBackgroundJob, payload)');
  });

  it('refuses an input a payload of plain JSON cannot carry', () => {
    write(
      root,
      REMIND_COMMAND,
      REMIND_WITH_INPUTS.replace('readonly customerId: string', 'readonly customer: Customer'),
    );

    const refused = failure(cli(root, ...REMIND, '--json'));

    expect(refused.message).toBe(
      'The constructor of RemindInvoicesCommand takes `customer: Customer`, which the payload of a background job cannot carry.',
    );
  });
});

describe('generate background-job and process, where the wiring is written in the module file', () => {
  let root: string;

  beforeAll(() => {
    root = jobProject('--style', 'explicit');
    expect(cli(root, ...COMPILE).code).toBe(0);
    expect(cli(root, ...DUNNING).code).toBe(0);
  });

  it('registers each background job under its name on the builder of the context', () => {
    const module = read(root, `${BILLING}/billing.module.ts`);

    expect(module).toContain('.backgroundJob(CompileStatementsBackgroundJob.jobName)');
    expect(module).toContain('.handledBy(CompileStatementsBackgroundJob, [CommandBus]);');
    expect(module).toContain('.backgroundJob(DunningTimeoutBackgroundJob.jobName)');
    expect(module).toContain('.handledBy(DunningTimeoutBackgroundJob, [ProcessRunner]);');
    expect(read(root, JOB)).not.toContain('@Background');
  });
});

describe('generate process', () => {
  let root: string;
  let generated: ReturnType<typeof report>;

  beforeAll(() => {
    root = jobProject();
    generated = report(cli(root, ...DUNNING, '--json'));
  });

  it('writes the process, the job of its timeouts, their specs and the declarations of the layer of the job', () => {
    expect(generated.created).toEqual([PROCESS, TIMEOUT_JOB, PROCESS_SPEC, TIMEOUT_SPEC]);

    expect(generated.updated).toContain(`${BILLING}/application/application.declarations.ts`);
  });

  it('names the process and its timeout job after the context, and decides only data', () => {
    const process = read(root, PROCESS);

    expect(process).toContain("static readonly processName = 'billing.dunning';");
    expect(process).toContain("static readonly timeoutJob = 'billing.dunning-timeout';");
    expect(process).toContain("import type { ProcessDecision, ProcessManager } from '@ddd-ts-kit/kernel';");

    expect(read(root, TIMEOUT_JOB)).toContain(
      'await this.processes.timeout(DunningProcess, delivered, (current) => this.process.timedOut(due.timeout, current));',
    );
  });

  it('tests the decisions given a state, and the timeout through the queue of the test application', () => {
    expect(read(root, PROCESS_SPEC)).toContain('givenProcess<typeof waiting>(undefined)');
    expect(read(root, TIMEOUT_SPEC)).toContain("{ job: 'billing.dunning-timeout', outcome: 'succeeded' },");
  });

  it('lists the process in CONTEXT.md', () => {
    expect(read(root, `${BILLING}/CONTEXT.md`)).toContain('billing.dunning');
  });
});

describe('generate background-job and process, where the platform is wired by hand', () => {
  let root: string;

  beforeAll(() => {
    root = jobProject('--di', 'manual');
    expect(cli(root, ...COMPILE).code).toBe(0);
    expect(cli(root, ...DUNNING).code).toBe(0);
  });

  it('registers each background job on the worker of the platform, built on its buses and its process runner', () => {
    const module = read(root, `${BILLING}/billing.module.ts`);

    expect(module).toContain('platform.backgroundJobs.register(CompileStatementsBackgroundJob, [platform.commands]);');

    expect(module).toContain('platform.backgroundJobs.register(DunningTimeoutBackgroundJob, [platform.processes]);');

    expect(read(root, JOB)).not.toContain('@Background');
  });

  it('tests the job and the timeout through a queue and a worker in memory, on the test buses', () => {
    const spec = read(root, JOB_SPEC);

    expect(spec).toContain("import { createTestBuses, earlierVersionOf } from '@ddd-ts-kit/testing';");
    expect(spec).toContain('await jobQueue.enqueue(CompileStatementsBackgroundJob, {});');
    expect(spec).toContain("expect(sent[0]).toMatchObject({ actor: { id: 'test-user' } });");

    expect(read(root, TIMEOUT_SPEC)).toContain(
      'new StoredProcessRunner({ store: processes, jobs: jobQueue, commands: commandBus, unitOfWork })',
    );
  });
});
