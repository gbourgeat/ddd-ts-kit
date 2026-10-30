import { schedulingJobName } from '../../src/rules/scheduling-job-name';
import { schedulingJobTriggersUseCase } from '../../src/rules/scheduling-job-triggers-use-case';
import { at, BILLING, ruleTester } from '../support/rule-tester';

const DECLARATIONS = '@ddd-ts-kit/kernel/declarations';
const JOB = `${BILLING}/application/scheduling/send-reminders.job.ts`;
const MODULE = `${BILLING}/billing.module.ts`;
const HEAD = `import { CommandBus, systemActor } from '@ddd-ts-kit/kernel';\nimport { Scheduled, type JobExecution, type ScheduledJob } from '${DECLARATIONS}';\n`;

const RUN =
  "async run(execution: JobExecution): Promise<void> {\n    await this.commands.execute(new SendRemindersCommand(systemActor('billing.send-reminders'), execution.scheduledAt));\n  }";

const job = (name: string, body: string = RUN, list = 'CommandBus'): string =>
  `${HEAD}@Scheduled(${name}, { every: '15m' }, [${list}])\nexport class SendRemindersJob implements ScheduledJob {\n  constructor(private readonly commands: CommandBus) {}\n\n  ${body}\n}`;

const DECLARED_JOB = job("'billing.send-reminders'");
const FROM_REPOSITORIES = "import { InvoiceRepository } from '../../domain/repositories/invoice.repository.js';\n";

ruleTester.run('scheduling-job-triggers-use-case', schedulingJobTriggersUseCase, {
  valid: [
    at(JOB, DECLARED_JOB),
    at(
      JOB,
      'export class SendRemindersJob implements ScheduledJob {\n  constructor(private readonly commands: CommandBus) {}\n  run = async (): Promise<void> => { await this.commands.execute(new C()); };\n}',
    ),
    at(
      JOB,
      "import type { InvoiceId } from '../../domain/value-objects/invoice-id.vo.js';\nimport { SendRemindersCommand } from '../commands/send-reminders/send-reminders.command.js';\nexport class SendRemindersJob implements ScheduledJob { async run(): Promise<void> { await bus.execute(new SendRemindersCommand()); } }",
    ),
    at(
      MODULE,
      "import { SendRemindersJob } from './application/scheduling/send-reminders.job.js';\nbuilder.job('billing.send-reminders', { every: '15m' }).handledBy(SendRemindersJob, [CommandBus]);",
    ),
    at(
      MODULE,
      "builder.job('billing.purge', { every: '1d' }).handledByFactory((resolve) => make(resolve));\nbuilder.command(C).handledBy(H, []);",
    ),
    at(
      `${BILLING}/test/unit/send-reminders.job.spec.ts`,
      `${HEAD}@Scheduled('billing.probe', { every: '1m' }, [])\nclass Probe {}`,
    ),
    at(
      'src/platform/scheduling/heartbeat.ts',
      `${HEAD}@Scheduled('platform.heartbeat', { every: '1m' }, [])\nexport class Heartbeat {}`,
    ),
  ],
  invalid: [
    {
      ...at(JOB, 'export class SendRemindersJob { async run(): Promise<void> { await bus.execute(new C()); } }'),
      errors: [{ messageId: 'notAJob', line: 1 }],
    },
    { ...at(JOB, 'export const job = 1;'), errors: [{ messageId: 'notAJob' }] },
    {
      ...at(
        JOB,
        job("'billing.send-reminders'", 'async run(): Promise<void> {\n    await this.reminders.sendAll();\n  }'),
      ),
      errors: [{ messageId: 'noCommand', data: { className: 'SendRemindersJob' } }],
    },
    { ...at(JOB, 'export class SendRemindersJob implements ScheduledJob {}'), errors: [{ messageId: 'noCommand' }] },
    {
      ...at(
        JOB,
        `${FROM_REPOSITORIES}${job("'billing.send-reminders'", RUN, 'CommandBus, InvoiceRepository').replace('commands: CommandBus)', 'commands: CommandBus, private readonly invoices: InvoiceRepository)')}`,
      ),
      errors: [
        { messageId: 'repository', data: { className: 'SendRemindersJob', name: 'InvoiceRepository' } },
        { messageId: 'repository', data: { className: 'SendRemindersJob', name: 'InvoiceRepository' } },
      ],
    },
    {
      ...at(
        JOB,
        `import { Invoice } from '../../domain/aggregates/invoice.aggregate.js';\nimport { Pricing } from '../../domain/services/pricing.service.js';\nimport { Line } from '../../domain/entities/line.entity.js';\nimport { KnexDatabase } from '../../infrastructure/persistence/knex-database.js';\n${DECLARED_JOB}`,
      ),
      errors: [
        { messageId: 'model', data: { target: 'domain/aggregates/' } },
        { messageId: 'model', data: { target: 'domain/services/' } },
        { messageId: 'model', data: { target: 'domain/entities/' } },
        { messageId: 'model', data: { target: 'infrastructure/' } },
      ],
    },
    {
      ...at(
        `${BILLING}/application/commands/send-reminders/send-reminders.handler.ts`,
        `${HEAD}@Scheduled('billing.send-reminders', { every: '15m' }, [])\nexport class SendRemindersHandler {}`,
      ),
      errors: [
        {
          messageId: 'misplaced',
          data: {
            className: 'SendRemindersHandler',
            file: `${BILLING}/application/commands/send-reminders/send-reminders.handler.ts`,
          },
        },
      ],
    },
    {
      ...at(
        `${BILLING}/application/scheduling/send-reminders.ts`,
        `${HEAD}@Scheduled('billing.send-reminders', { every: '15m' }, [])\nexport class SendRemindersJob {}`,
      ),
      errors: [{ messageId: 'misplaced' }],
    },
    {
      ...at(
        MODULE,
        "import { Purge } from './infrastructure/external/purge.js';\nbuilder.job('billing.purge', { every: '1d' }).handledBy(Purge, []);",
      ),
      errors: [
        { messageId: 'misplaced', data: { className: 'Purge', file: `${BILLING}/infrastructure/external/purge.ts` } },
      ],
    },
    {
      ...at(
        MODULE,
        "import { Heartbeat } from '@/platform/scheduling/heartbeat.js';\nbuilder.job('billing.heartbeat', { every: '1m' }).handledBy(Heartbeat, []);",
      ),
      errors: [
        { messageId: 'misplaced', data: { className: 'Heartbeat', file: 'src/platform/scheduling/heartbeat.ts' } },
      ],
    },
  ],
});

ruleTester.run('scheduling-job-name', schedulingJobName, {
  valid: [
    at(JOB, DECLARED_JOB),
    at(
      JOB,
      'export class SendRemindersJob implements ScheduledJob { async run(): Promise<void> { await bus.execute(new C(systemActor("billing.send-reminders"))); } }',
    ),
    at(
      MODULE,
      "builder.job('billing.send-reminders', { every: '15m' }).handledBy(SendRemindersJob, [CommandBus]);\nbuilder.job(`billing.purge-2`, { cron: '0 3 * * *' }).handledByFactory(make);",
    ),
    at('src/main.ts', "builder.job('platform.heartbeat', { every: '1m' }).handledBy(Heartbeat, []);"),
    at(MODULE, "queue.job(name).start();\nconst actor = systemActor('anything');"),
    at(
      `${BILLING}/test/unit/send-reminders.job.spec.ts`,
      "builder.job('probe', { every: '1m' }).handledBy(Probe, []);",
    ),
  ],
  invalid: [
    { ...at(JOB, job('JOB_NAME')), errors: [{ messageId: 'notLiteral', data: { context: 'billing' } }] },
    {
      ...at(JOB, job("'billing.SendReminders'")),
      errors: [
        { messageId: 'format', data: { name: 'billing.SendReminders', context: 'billing' } },
        { messageId: 'actor' },
      ],
    },
    {
      ...at(
        JOB,
        job("'send-reminders'").replace("systemActor('billing.send-reminders')", "systemActor('send-reminders')"),
      ),
      errors: [{ messageId: 'format' }],
    },
    { ...at(JOB, job("'billing.reminders.send'")), errors: [{ messageId: 'format' }, { messageId: 'actor' }] },
    {
      ...at(JOB, job("'catalog.send-reminders'")),
      errors: [
        { messageId: 'context', data: { name: 'catalog.send-reminders', context: 'billing', job: 'send-reminders' } },
        { messageId: 'actor', data: { given: "'billing.send-reminders'", name: 'catalog.send-reminders' } },
      ],
    },
    {
      ...at(
        JOB,
        job("'billing.send-reminders'").replace("systemActor('billing.send-reminders')", 'systemActor(this.name)'),
      ),
      errors: [{ messageId: 'actor', data: { given: '..', name: 'billing.send-reminders' } }],
    },
    {
      ...at(
        JOB,
        'export class SendRemindersJob implements ScheduledJob { async run(): Promise<void> { await bus.execute(new C(systemActor("reminders"))); } }',
      ),
      errors: [{ messageId: 'actor', data: { given: "'reminders'", name: 'billing.<job-name>' } }],
    },
    {
      ...at(
        MODULE,
        "builder.job('catalog.purge', { every: '1d' }).handledBy(Purge, []);\nbuilder.job(name, options).handledByFactory(make);",
      ),
      errors: [{ messageId: 'context' }, { messageId: 'notLiteral' }],
    },
    {
      ...at('src/main.ts', "builder.job('Heartbeat', { every: '1m' }).handledBy(Heartbeat, []);"),
      errors: [{ messageId: 'format', data: { name: 'Heartbeat', context: '<context>' } }],
    },
  ],
});
