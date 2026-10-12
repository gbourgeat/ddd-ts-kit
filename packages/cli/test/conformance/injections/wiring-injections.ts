import type { Injection } from '../injection.js';
import { PATHS } from '../paths.js';
import { SOURCE_ALIAS } from '../source-alias.js';
import { SOURCE_SUFFIX } from '../source-suffix.js';

const { ADAPTER, DUE_HANDLER, EVENT_HANDLER, JOB, OCCUPANCY_ROUTE, PLAN_HANDLER, PORT, SEND_HANDLER } = PATHS;

const CONCRETE =
  'What implements a port lives outside the application layer: naming it there is also an import that leaves the layer.';

const ALIAS = `${SOURCE_ALIAS}contexts/notification`;
/** The ending the example does not write: `.js` when its config says `none`, nothing otherwise. */
const OTHER_SUFFIX = SOURCE_SUFFIX === '' ? '.js' : '';
const PORT_IMPORT = `import { ReminderRepository } from '${ALIAS}/domain/repositories/reminder.repository${SOURCE_SUFFIX}';`;
const USER_CONTEXT = 'src/shared-kernel/user-context.ts';

const LISTED =
  'A list in a decorator is a second statement of the dependencies in a project that states them in constructor signatures: the rule that holds the single statement reports it too.';

const STALE =
  'The generated list of a class is read from its constructor: a changed signature leaves the barrel stale until it is regenerated.';

const SECOND_STATEMENT = [
  { tool: 'checker', rule: 'declarations/constructor-injection', reason: LISTED },
  { tool: 'eslint', rule: 'ddd-ts-kit/declarations-constructor-injection', reason: LISTED },
  {
    tool: 'checker',
    rule: 'declarations/barrel-current',
    reason:
      'A class that lists its dependencies in its decorator is registered no list by the generated file, which still holds the one read from its constructor.',
  },
] as const;

/** How classes are declared, wired and scheduled, and what stays outside the contexts. */
export const WIRING_INJECTIONS: readonly Injection[] = [
  {
    rule: 'declarations/role-declared',
    what: 'a domain event handler named after another event than the one it handles',
    file: EVENT_HANDLER,
    changes: [
      {
        file: EVENT_HANDLER,
        from: "{ name: 'notification.reminder.sent' }",
        to: "{ name: 'notification.reminder.planned' }",
      },
    ],
    checker: true,
    eslint: 'ddd-ts-kit/declarations-role-declared',
  },
  {
    rule: 'ports/abstract-class',
    what: 'a port with a method body',
    file: PORT,
    changes: [
      {
        file: PORT,
        from: 'export abstract class Mailer {\n',
        to: 'export abstract class Mailer {\n  isReachable(): boolean {\n    return true;\n  }\n\n',
      },
    ],
    checker: true,
    eslint: 'ddd-ts-kit/ports-abstract-class',
  },
  {
    rule: 'ports/implements-never-extends',
    what: 'an adapter that extends its port',
    file: ADAPTER,
    changes: [{ file: ADAPTER, from: 'implements Mailer', to: 'extends Mailer' }],
    checker: true,
    eslint: 'ddd-ts-kit/ports-implements-never-extends',
  },
  {
    rule: 'ports/no-token-constant',
    what: 'an upper-case constant in a dependency list',
    file: DUE_HANDLER,
    changes: [
      {
        file: DUE_HANDLER,
        from: '@CommandHandler(SendDueRemindersCommand)',
        to: '@CommandHandler(SendDueRemindersCommand, [REMINDER_REPOSITORY])',
      },
    ],
    checker: true,
    eslint: 'ddd-ts-kit/ports-no-token-constant',
    alsoReports: SECOND_STATEMENT,
  },
  {
    rule: 'ports/no-concrete-dependency',
    what: 'a constructor parameter typed by the fake of a repository',
    file: SEND_HANDLER,
    changes: [
      {
        file: SEND_HANDLER,
        where: 'start',
        to: `import { FakeNotificationRepository } from '${ALIAS}/test/fakes/notification.repository.fake${SOURCE_SUFFIX}';\n`,
      },
      {
        file: SEND_HANDLER,
        from: '    private readonly notificationRepository: NotificationRepository,\n',
        to: '    private readonly notificationRepository: NotificationRepository,\n    private readonly stored: FakeNotificationRepository,\n',
      },
    ],
    checker: true,
    eslint: 'ddd-ts-kit/ports-no-concrete-dependency',
    alsoReports: [
      { tool: 'checker', rule: 'layer/application-inward', reason: CONCRETE },
      { tool: 'eslint', rule: 'ddd-ts-kit/layer-application-inward', reason: CONCRETE },
      { tool: 'checker', rule: 'declarations/barrel-current', reason: STALE },
    ],
  },
  {
    rule: 'declarations/constructor-injection',
    what: 'a constructor parameter typed by a type of the language, which names nothing to inject',
    file: PLAN_HANDLER,
    changes: [
      {
        file: PLAN_HANDLER,
        from: '    private readonly clock: Clock,\n',
        to: '    private readonly clock: Clock,\n    private readonly retries: number,\n',
      },
    ],
    checker: true,
    eslint: 'ddd-ts-kit/declarations-constructor-injection',
    alsoReports: [{ tool: 'checker', rule: 'declarations/barrel-current', reason: STALE }],
  },
  {
    rule: 'ports/value-import',
    what: 'a port of a dependency list imported as a type',
    file: PLAN_HANDLER,
    changes: [
      {
        file: PLAN_HANDLER,
        from: '@CommandHandler(PlanReminderCommand)',
        to: '@CommandHandler(PlanReminderCommand, [ReminderRepository, IdGenerator, Clock])',
      },
    ],
    checker: true,
    eslint: 'ddd-ts-kit/ports-value-import',
    alsoReports: SECOND_STATEMENT,
  },
  {
    rule: 'scheduling/job-triggers-use-case',
    what: 'a job given a repository, to do the work itself',
    file: JOB,
    changes: [
      { file: JOB, where: 'start', to: `${PORT_IMPORT}\n` },
      {
        file: JOB,
        from: '  constructor(private readonly commands: CommandBus) {}',
        to: '  constructor(\n    private readonly commands: CommandBus,\n    private readonly reminderRepository: ReminderRepository,\n  ) {}',
      },
    ],
    checker: true,
    eslint: 'ddd-ts-kit/scheduling-job-triggers-use-case',
    alsoReports: [{ tool: 'checker', rule: 'declarations/barrel-current', reason: STALE }],
  },
  {
    rule: 'scheduling/job-name',
    what: 'a job name that is not <context>.<job-name>',
    file: JOB,
    changes: [
      { file: JOB, from: "@Scheduled('notification.send-due-reminders'", to: "@Scheduled('SendDueReminders'" },
      { file: JOB, from: "systemActor('notification.send-due-reminders')", to: "systemActor('SendDueReminders')" },
    ],
    checker: true,
    eslint: 'ddd-ts-kit/scheduling-job-name',
  },
  {
    rule: 'imports/alias-only',
    what: 'a relative import of the same directory',
    file: PLAN_HANDLER,
    changes: [
      {
        file: PLAN_HANDLER,
        from: `from '${ALIAS}/application/commands/plan-reminder/plan-reminder.command${SOURCE_SUFFIX}';`,
        to: `from './plan-reminder.command${SOURCE_SUFFIX}';`,
      },
    ],
    checker: true,
    eslint: 'ddd-ts-kit/imports-alias-only',
  },
  {
    rule: 'imports/extension',
    what: 'an import written in the spelling the config does not ask for',
    file: PLAN_HANDLER,
    changes: [
      {
        file: PLAN_HANDLER,
        from: `from '${ALIAS}/application/commands/plan-reminder/plan-reminder.command${SOURCE_SUFFIX}';`,
        to: `from '${ALIAS}/application/commands/plan-reminder/plan-reminder.command${OTHER_SUFFIX}';`,
      },
    ],
    checker: true,
    eslint: 'ddd-ts-kit/imports-extension',
  },
  {
    rule: 'aspects/outside-in',
    what: 'an aspect decorator imported by a route',
    file: OCCUPANCY_ROUTE,
    changes: [{ file: OCCUPANCY_ROUTE, where: 'start', to: "import '@ddd-ts-kit/aspects/decorators';\n" }],
    checker: true,
    eslint: 'ddd-ts-kit/aspects-outside-in',
  },
  {
    rule: 'tracing/platform-only',
    what: 'a tracing import in an adapter',
    file: ADAPTER,
    changes: [{ file: ADAPTER, where: 'start', to: "import '@ddd-ts-kit/tracing';\n" }],
    checker: true,
    eslint: 'ddd-ts-kit/tracing-platform-only',
  },
  {
    rule: 'standard/no-parallel-interface',
    what: 'a home-made user context next to the execution context of the kernel',
    file: USER_CONTEXT,
    changes: [
      {
        file: USER_CONTEXT,
        to: 'export interface UserContext {\n  readonly userId: string;\n  readonly practiceId: string;\n}\n',
      },
    ],
    checker: true,
    eslint: 'ddd-ts-kit/standard-no-parallel-interface',
  },
  {
    rule: 'governance/recorded-deviation',
    what: 'a lint suppression with a reason and no decision record',
    file: ADAPTER,
    changes: [
      {
        file: ADAPTER,
        from: '    signal?.throwIfAborted();\n',
        to: '    // eslint-disable-next-line no-debugger -- handy while the provider is not chosen\n    debugger;\n\n    signal?.throwIfAborted();\n',
      },
    ],
    checker: true,
    eslint: 'ddd-ts-kit/governance-recorded-deviation',
  },
];
