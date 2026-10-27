import { CONFIG_FILE } from '../../config';
import { config } from './config';
import { DECLARED } from './declared';
import { declaredProject } from './declared-project';
import type { Fixture } from './fixture';
import { PATHS } from './paths';
import { project } from './project';
import { SAMPLES } from './samples';
import { source } from './source';

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
        '@/contexts/billing/application/scheduling/send-reminders.job.js',
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
        "import { Invoice } from '@/contexts/billing/domain/aggregates/invoice.aggregate.js';",
        "import { InvoiceRepository } from '@/contexts/billing/domain/repositories/invoice.repository.js';",
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
        '@/contexts/billing/infrastructure/external/send-reminders.js',
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
        '@/contexts/billing/application/scheduling/send-reminders.job.js',
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
      [MODULE]: moduleRegistering('@/contexts/billing/application/scheduling/send-reminders.job.js', 'SendReminders'),
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

const TENANCY_RULE = 'scheduling/tenancy-declared';
const TENANT_CONFIG = { [CONFIG_FILE]: config({ stack: { style: 'declared', tenancy: 'shared-table' } }) };
const PER_TENANT = "{ every: '15m', tenancy: 'per-tenant' }";

const TENANCY_DECLARED: readonly Fixture[] = [
  {
    ruleId: TENANCY_RULE,
    name: 'a job that runs per tenant',
    expect: 'pass',
    files: declaredProject({ [JOB]: tenantJob(PER_TENANT), [JOB_SPEC]: SPEC }, TENANT_CONFIG),
  },
  {
    ruleId: TENANCY_RULE,
    name: 'a job that is global on purpose',
    expect: 'pass',
    files: declaredProject(
      { [JOB]: tenantJob("{ every: '15m', tenancy: 'global' }"), [JOB_SPEC]: SPEC },
      TENANT_CONFIG,
    ),
  },
  {
    ruleId: TENANCY_RULE,
    name: 'a job without tenancy, in a project without tenants',
    expect: 'pass',
    files: declaredProject({ [JOB]: DECLARED.job, [JOB_SPEC]: SPEC }),
  },
  {
    ruleId: TENANCY_RULE,
    name: 'a job that does not say whether it runs per tenant or globally',
    expect: { file: JOB },
    files: declaredProject({ [JOB]: DECLARED.job, [JOB_SPEC]: SPEC }, TENANT_CONFIG),
  },
  {
    ruleId: TENANCY_RULE,
    name: 'explicit style: a job registered by the module file without tenancy',
    expect: { file: MODULE },
    files: project(
      {
        [JOB]: PLAIN_JOB,
        [JOB_SPEC]: SPEC,
        [MODULE]: moduleRegistering(
          '@/contexts/billing/application/scheduling/send-reminders.job.js',
          'billing.send-reminders',
        ),
      },
      { [CONFIG_FILE]: config({ stack: { tenancy: 'shared-table' } }) },
    ),
  },
  {
    ruleId: TENANCY_RULE,
    name: 'options the checker cannot read, a constant',
    expect: { file: JOB },
    files: declaredProject({ [JOB]: tenantJob('JOB_OPTIONS'), [JOB_SPEC]: SPEC }, TENANT_CONFIG),
  },
  {
    ruleId: TENANCY_RULE,
    name: 'options the checker cannot read, a spread',
    expect: { file: JOB },
    files: declaredProject({ [JOB]: tenantJob("{ ...BASE, every: '15m' }"), [JOB_SPEC]: SPEC }, TENANT_CONFIG),
  },
  {
    ruleId: TENANCY_RULE,
    name: 'a tenancy the checker cannot read, a constant',
    expect: { file: JOB },
    files: declaredProject({ [JOB]: tenantJob("{ every: '15m', tenancy: TENANCY }"), [JOB_SPEC]: SPEC }, TENANT_CONFIG),
  },
  {
    ruleId: TENANCY_RULE,
    name: 'a tenancy written as a shorthand',
    expect: { file: JOB },
    files: declaredProject({ [JOB]: tenantJob("{ every: '15m', tenancy }"), [JOB_SPEC]: SPEC }, TENANT_CONFIG),
  },
];

const REGISTERED = 'scheduling/job-registered';
const BACKGROUND_JOB = `${BILLING}/application/background/purge-drafts.background-job.ts`;
const BACKGROUND_JOB_SPEC = `${BILLING}/test/unit/purge-drafts.background-job.spec.ts`;

const PURGE_JOB = source(
  "import type { BackgroundJob, BackgroundJobExecution, CommandBus } from '@ddd-ts-kit/kernel';",
  '',
  'export class PurgeDraftsBackgroundJob implements BackgroundJob<Record<string, never>> {',
  "  static readonly jobName = 'billing.purge-drafts';",
  '',
  '  constructor(private readonly commands: CommandBus) {}',
  '',
  '  async run(payload: Record<string, never>, execution: BackgroundJobExecution): Promise<void> {}',
  '}',
);

const REGISTERING_PURGE = source(
  "import { PurgeDraftsBackgroundJob } from '@/contexts/billing/application/background/purge-drafts.background-job.js';",
  '',
  'export function billingModule(platform: Platform): void {',
  '  platform.backgroundJobs.register(PurgeDraftsBackgroundJob, [platform.commands]);',
  '}',
);

const JOB_REGISTERED: readonly Fixture[] = [
  {
    ruleId: REGISTERED,
    name: 'a declared job that carries @Scheduled',
    expect: 'pass',
    files: declaredProject({ [JOB]: DECLARED.job, [JOB_SPEC]: SPEC }),
  },
  {
    ruleId: REGISTERED,
    name: 'explicit style: a job the module file registers',
    expect: 'pass',
    files: project({
      [JOB]: PLAIN_JOB,
      [JOB_SPEC]: SPEC,
      [MODULE]: moduleRegistering(
        '@/contexts/billing/application/scheduling/send-reminders.job.js',
        'billing.send-reminders',
      ),
    }),
  },
  {
    ruleId: REGISTERED,
    name: 'explicit style: a background job the module file registers',
    expect: 'pass',
    files: project({ [BACKGROUND_JOB]: PURGE_JOB, [BACKGROUND_JOB_SPEC]: SPEC, [MODULE]: REGISTERING_PURGE }),
  },
  {
    ruleId: REGISTERED,
    name: 'explicit style: a job written and registered by no module file',
    expect: { file: JOB },
    files: project({ [JOB]: PLAIN_JOB, [JOB_SPEC]: SPEC }),
  },
  {
    ruleId: REGISTERED,
    name: 'explicit style: a background job no module file registers',
    expect: { file: BACKGROUND_JOB },
    files: project({ [BACKGROUND_JOB]: PURGE_JOB, [BACKGROUND_JOB_SPEC]: SPEC }),
  },
];

export const SCHEDULING_FIXTURES: readonly Fixture[] = [
  ...TRIGGERS_USE_CASE,
  ...JOB_NAME,
  ...TENANCY_DECLARED,
  ...JOB_REGISTERED,
];

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

function tenantJob(options: string): string {
  return DECLARED.job.replace("{ every: '15m' }", options);
}
