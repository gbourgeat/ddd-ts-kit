import { DECLARED } from './declared.js';
import { declaredProject } from './declared-project.js';
import type { Fixture } from './fixture.js';
import { PATHS } from './paths.js';
import { project } from './project.js';
import { SAMPLES } from './samples.js';
import { source } from './source.js';

const { BILLING, JOB, JOB_SPEC, MODULE } = PATHS;
const { SPEC } = SAMPLES;

const RESEND_JOB = `${BILLING}/application/scheduling/resend-reminders.job.ts`;
const RESEND_JOB_SPEC = `${BILLING}/test/unit/resend-reminders.job.spec.ts`;

/** The job of the explicit style: the same class, registered by the module file instead of declaring itself. */
const PLAIN_JOB = DECLARED.job
  .replace('import { Scheduled, type JobExecution, type ScheduledJob }', 'import type { JobExecution, ScheduledJob }')
  .replace("@Scheduled('billing.send-reminders', { every: '15m' }, [CommandBus])\n", '');

const TRIGGERS_USE_CASE: readonly Fixture[] = [
  {
    ruleId: 'scheduling/job-triggers-use-case',
    name: 'a declared job that sends one command',
    expect: 'pass',
    files: declaredProject({ [JOB]: DECLARED.job, [JOB_SPEC]: SPEC }),
  },
  {
    ruleId: 'scheduling/job-triggers-use-case',
    name: 'explicit style: the same job registered by the module file',
    expect: 'pass',
    files: project({
      [JOB]: PLAIN_JOB,
      [JOB_SPEC]: SPEC,
      [MODULE]: moduleRegistering(
        '#src/contexts/billing/application/scheduling/send-reminders.job.js',
        'billing.send-reminders',
      ),
    }),
  },
  {
    ruleId: 'scheduling/job-triggers-use-case',
    name: 'a job that does the work itself, through a repository and an aggregate',
    expect: { file: JOB },
    files: declaredProject({
      [JOB]: source(
        "import { Scheduled, type ScheduledJob } from '@ddd-ts-kit/kernel/declarations';",
        "import { Invoice } from '#src/contexts/billing/domain/aggregates/invoice.aggregate.js';",
        "import { InvoiceRepository } from '#src/contexts/billing/domain/repositories/invoice.repository.js';",
        '',
        "@Scheduled('billing.send-reminders', { every: '15m' }, [InvoiceRepository])",
        'export class SendRemindersJob implements ScheduledJob {',
        '  constructor(private readonly invoices: InvoiceRepository) {}',
        '',
        '  async run(): Promise<void> {',
        '    await this.invoices.save(Invoice.overdue());',
        '  }',
        '}',
      ),
      [JOB_SPEC]: SPEC,
    }),
  },
  {
    ruleId: 'scheduling/job-triggers-use-case',
    name: 'a job class that does not implement ScheduledJob',
    expect: { file: JOB },
    files: declaredProject({
      [JOB]: DECLARED.job.replace(' implements ScheduledJob', '').replace(', type ScheduledJob', ''),
      [JOB_SPEC]: SPEC,
    }),
  },
  {
    ruleId: 'scheduling/job-triggers-use-case',
    name: 'explicit style: a job registered from a file that is not a job file',
    expect: { file: MODULE },
    files: project({
      [MODULE]: moduleRegistering(
        '#src/contexts/billing/infrastructure/external/send-reminders.js',
        'billing.send-reminders',
      ),
    }),
  },
];

const JOB_NAME: readonly Fixture[] = [
  {
    ruleId: 'scheduling/job-name',
    name: 'a job named after its context, the system actor under the same name',
    expect: 'pass',
    files: declaredProject({ [JOB]: DECLARED.job, [JOB_SPEC]: SPEC }),
  },
  {
    ruleId: 'scheduling/job-name',
    name: 'explicit style: the name written in the module file of the context',
    expect: 'pass',
    files: project({
      [JOB]: PLAIN_JOB,
      [JOB_SPEC]: SPEC,
      [MODULE]: moduleRegistering(
        '#src/contexts/billing/application/scheduling/send-reminders.job.js',
        'billing.send-reminders',
      ),
    }),
  },
  {
    ruleId: 'scheduling/job-name',
    name: 'a job named by a constant',
    expect: { file: JOB },
    files: declaredProject({
      [JOB]: DECLARED.job.replaceAll("'billing.send-reminders'", 'JOB_NAME'),
      [JOB_SPEC]: SPEC,
    }),
  },
  {
    ruleId: 'scheduling/job-name',
    name: 'a job carrying the prefix of another context',
    expect: { file: JOB },
    files: declaredProject({
      [JOB]: DECLARED.job.replaceAll('billing.send-reminders', 'catalog.send-reminders'),
      [JOB_SPEC]: SPEC,
    }),
  },
  {
    ruleId: 'scheduling/job-name',
    name: 'a name that is not two kebab-case segments, registered in a module file',
    expect: { file: MODULE },
    files: project({
      [JOB]: PLAIN_JOB,
      [JOB_SPEC]: SPEC,
      [MODULE]: moduleRegistering(
        '#src/contexts/billing/application/scheduling/send-reminders.job.js',
        'SendReminders',
      ),
    }),
  },
  {
    ruleId: 'scheduling/job-name',
    name: 'a system actor under another name than the job',
    expect: { file: JOB },
    files: declaredProject({
      [JOB]: DECLARED.job.replace("systemActor('billing.send-reminders')", "systemActor('billing.reminders')"),
      [JOB_SPEC]: SPEC,
    }),
  },
  {
    ruleId: 'scheduling/job-name',
    name: 'one job name used by two jobs',
    expect: { file: JOB },
    files: declaredProject({
      [RESEND_JOB]: DECLARED.job.replace('SendRemindersJob', 'ResendRemindersJob'),
      [RESEND_JOB_SPEC]: SPEC,
      [JOB]: DECLARED.job,
      [JOB_SPEC]: SPEC,
    }),
  },
];

export const SCHEDULING_FIXTURES: readonly Fixture[] = [...TRIGGERS_USE_CASE, ...JOB_NAME];

function moduleRegistering(jobFile: string, name: string): string {
  return source(
    "import { defineModule } from '@ddd-ts-kit/di';",
    "import { CommandBus } from '@ddd-ts-kit/kernel';",
    `import { SendRemindersJob } from '${jobFile}';`,
    '',
    "export const billingModule = defineModule('billing', (builder) => {",
    `  builder.job('${name}', { every: '15m' }).handledBy(SendRemindersJob, [CommandBus]);`,
    '});',
  );
}
