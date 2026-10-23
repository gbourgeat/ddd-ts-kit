import type { Injection } from '../injection';
import { PATHS } from '../paths';
import { SOURCE_ALIAS } from '../source-alias';
import { SOURCE_SUFFIX } from '../source-suffix';

const { AGGREGATE, COMMAND, SEND_HANDLER, SENT_AGGREGATE, ROUTE, SCHEDULING, VALUE_OBJECT } = PATHS;
const CALENDAR_DAY = `${SCHEDULING}/application/calendars/queries/get-calendar-day/get-calendar-day.handler.ts`;
const CALENDARS_GROUP = `${SCHEDULING}/presentation/http/calendars.routes.ts`;
const DUE = '  return new Date(startsAt.getTime() - NOTICE_MS);';

const READ =
  "    const scope = await this.access.scope(actor, schedulingPermissions['appointment.read'], 'appointment');\n";

/** What the domain and the use cases do: purity, the model, authorization at the edge. */
const GUARD_FILE = 'src/contexts/notification/presentation/http/guards/own-reminder.guard.ts';

export const BEHAVIOUR_INJECTIONS: readonly Injection[] = [
  {
    rule: 'purity/no-system-clock',
    what: 'an aggregate that reads the clock of the machine',
    file: SENT_AGGREGATE,
    changes: [
      {
        file: SENT_AGGREGATE,
        from: '{ ...facts, registeredAt: now }',
        to: '{ ...facts, registeredAt: new Date(Math.min(now.getTime(), Date.now())) }',
      },
    ],
    checker: true,
    eslint: 'ddd-ts-kit/purity-no-system-clock',
  },
  {
    rule: 'purity/no-ambient-randomness',
    what: 'an aggregate that draws a random number',
    file: AGGREGATE,
    changes: [
      {
        file: AGGREGATE,
        from: DUE,
        to: '  return new Date(startsAt.getTime() - NOTICE_MS * Math.random());',
      },
    ],
    checker: true,
    eslint: 'ddd-ts-kit/purity-no-ambient-randomness',
  },
  {
    rule: 'purity/no-environment',
    what: 'an aggregate that reads an environment variable',
    file: AGGREGATE,
    changes: [
      {
        file: AGGREGATE,
        from: 'const NOTICE_MS = 24 * 60 * 60 * 1000;',
        to: "const NOTICE_MS = Number(process.env['NOTICE_MS'] ?? 86_400_000);",
      },
    ],
    checker: true,
    eslint: 'ddd-ts-kit/purity-no-environment',
  },
  {
    rule: 'domain/aggregate-encapsulation',
    what: 'an aggregate with a setter',
    file: SENT_AGGREGATE,
    changes: [
      {
        file: SENT_AGGREGATE,
        from: '  get recipientId(): string {',
        to: '  set recipientId(recipientId: string) {\n    this.state = { ...this.state, recipientId };\n  }\n\n  get recipientId(): string {',
      },
    ],
    checker: false,
    eslint: 'ddd-ts-kit/domain-aggregate-encapsulation',
  },
  {
    rule: 'domain/value-object-immutability',
    what: 'a value object with a property that can be reassigned',
    file: VALUE_OBJECT,
    changes: [
      {
        file: VALUE_OBJECT,
        from: '  private constructor(props: NotificationKindProps) {',
        to: "  label = '';\n\n  private constructor(props: NotificationKindProps) {",
      },
    ],
    checker: false,
    eslint: 'ddd-ts-kit/domain-value-object-immutability',
  },
  {
    rule: 'domain/no-generic-error',
    what: 'an aggregate that throws a plain Error',
    file: SENT_AGGREGATE,
    changes: [
      {
        file: SENT_AGGREGATE,
        from: '    const created = new Notification(',
        to: "    if (facts.cause === '') {\n      throw new Error('A notification has a cause.');\n    }\n\n    const created = new Notification(",
      },
    ],
    checker: false,
    eslint: 'ddd-ts-kit/domain-no-generic-error',
  },
  {
    rule: 'application/handler-shape',
    what: 'a handler with a second public method',
    file: SEND_HANDLER,
    changes: [
      {
        file: SEND_HANDLER,
        from: '  async execute(command: SendNotificationCommand): Promise<string> {',
        to: '  async sendAll(commands: readonly SendNotificationCommand[]): Promise<void> {\n    await Promise.all(commands.map((command) => this.execute(command)));\n  }\n\n  async execute(command: SendNotificationCommand): Promise<string> {',
      },
    ],
    checker: false,
    eslint: 'ddd-ts-kit/application-handler-shape',
  },
  {
    rule: 'application/command-query-separation',
    what: 'a query handler that saves the aggregate it read',
    file: CALENDAR_DAY,
    changes: [
      {
        file: CALENDAR_DAY,
        from: READ,
        to: `    await this.calendarRepository.save(calendar);\n\n${READ}`,
      },
    ],
    checker: false,
    eslint: 'ddd-ts-kit/application-command-query-separation',
  },
  {
    rule: 'authz/declared',
    what: 'a command that no longer says who may send it',
    file: COMMAND,
    changes: [
      {
        file: COMMAND,
        from: "import { Requires } from '@ddd-ts-kit/kernel/declarations';\n",
        to: '',
      },
      {
        file: COMMAND,
        from: `import { notificationPermissions } from '${SOURCE_ALIAS}contexts/notification/notification.permissions${SOURCE_SUFFIX}';\n`,
        to: '',
      },
      {
        file: COMMAND,
        from: "@Requires(notificationPermissions['reminder.withdraw'], { resource: () => ({ type: 'context', id: 'notification' }) })\n",
        to: '',
      },
    ],
    checker: true,
    eslint: 'ddd-ts-kit/authz-declared',
  },
  {
    rule: 'presentation/controller-shape',
    what: 'a controller with a second public method',
    file: ROUTE,
    changes: [
      {
        file: ROUTE,
        from: '  async handle(',
        to: '  count(): number {\n    return 0;\n  }\n\n  async handle(',
      },
    ],
    checker: false,
    eslint: 'ddd-ts-kit/presentation-controller-shape',
  },
  {
    rule: 'presentation/controller-delegates',
    what: 'a controller of a GET route that is given the command bus',
    file: ROUTE,
    changes: [
      {
        file: ROUTE,
        where: 'start',
        to: "import type { CommandBus } from '@ddd-ts-kit/kernel';\n",
      },
      {
        file: ROUTE,
        from: '  constructor(private readonly queries: QueryBus) {}',
        to: '  constructor(\n    private readonly queries: QueryBus,\n    private readonly commands: CommandBus,\n  ) {}',
      },
    ],
    checker: false,
    eslint: 'ddd-ts-kit/presentation-controller-delegates',
    alsoReports: [
      {
        tool: 'checker',
        rule: 'declarations/barrel-current',
        reason: 'the generated file of the context still registers the constructor as it was',
      },
    ],
  },
  {
    rule: 'presentation/guard-at-the-edge',
    what: 'a guard that loads through a repository',
    file: GUARD_FILE,
    changes: [
      {
        file: GUARD_FILE,
        to: `import { Guard, type GuardRequest } from '@ddd-ts-kit/http';\nimport type { ReminderRepository } from '${SOURCE_ALIAS}contexts/notification/domain/repositories/reminder.repository${SOURCE_SUFFIX}';\n\n@Guard()\nexport class OwnReminderGuard implements Guard {\n  constructor(private readonly reminderRepository: ReminderRepository) {}\n\n  async check({ params }: GuardRequest): Promise<void> {\n    await this.reminderRepository.findById(String(params['reminderId']));\n  }\n}\n`,
      },
    ],
    checker: false,
    eslint: 'ddd-ts-kit/presentation-guard-at-the-edge',
    alsoReports: [
      {
        tool: 'checker',
        rule: 'declarations/barrel-current',
        reason: 'the guard is a new role file the generated file of its context does not export yet',
      },
    ],
  },
  {
    rule: 'presentation/shared-cache-varies',
    what: 'a route group behind Authenticated whose answers shared caches would keep, whatever the caller',
    file: CALENDARS_GROUP,
    changes: [
      {
        file: CALENDARS_GROUP,
        from: "guards: [Authenticated], errors: ['FORBIDDEN'] })",
        to: "guards: [Authenticated], errors: ['FORBIDDEN'], cache: { scope: 'public', maxAge: '1m' } })",
      },
    ],
    checker: false,
    eslint: 'ddd-ts-kit/presentation-shared-cache-varies',
  },
];
