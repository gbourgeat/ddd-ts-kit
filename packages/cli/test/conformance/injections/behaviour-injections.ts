import type { Injection } from '../injection.js';
import { PATHS } from '../paths.js';
import { SOURCE_ALIAS } from '../source-alias.js';
import { SOURCE_SUFFIX } from '../source-suffix.js';

const { AGGREGATE, COMMAND, DUE_HANDLER, EVENT_HANDLER, HANDLER_SPEC, INTEGRATION_HANDLER, PLAN_HANDLER } = PATHS;
const { SEND_HANDLER, SENT_AGGREGATE } = PATHS;
const SENT = '    await this.notificationRepository.save(target);\n';

const CONSUMER =
  'The consumer name is held twice, as part of the declaration of the role and as the idempotency scope: both rules report its absence.';

const { PUBLISHED, ROUTE, SCHEDULING, VALUE_OBJECT } = PATHS;
const CALENDAR_DAY = `${SCHEDULING}/application/queries/get-calendar-day/get-calendar-day.handler.ts`;
const DUE = '  return new Date(startsAt.getTime() - NOTICE_MS);';
const SAVED = '    await this.reminderRepository.save(target);\n';
const TAKEN = '  constructor(private readonly commands: CommandBus) {}';

const STALE =
  'The generated list of a class is read from its constructor: a changed signature leaves the barrel stale until it is regenerated.';

const KERNEL = "import { type CommandBus, systemActor } from '@ddd-ts-kit/kernel';";

const READ =
  "    const scope = await this.access.scope(actor, schedulingPermissions['appointment.read'], 'appointment');\n";

/** What the domain and the use cases do: purity, the model, authorization, events. */
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
    changes: [{ file: AGGREGATE, from: DUE, to: '  return new Date(startsAt.getTime() - NOTICE_MS * Math.random());' }],
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
    changes: [{ file: CALENDAR_DAY, from: READ, to: `    await this.calendarRepository.save(calendar);\n\n${READ}` }],
    checker: false,
    eslint: 'ddd-ts-kit/application-command-query-separation',
  },
  {
    rule: 'authz/declared',
    what: 'a command that no longer says who may send it',
    file: COMMAND,
    changes: [
      { file: COMMAND, from: "import { Requires } from '@ddd-ts-kit/kernel/declarations';\n", to: '' },
      {
        file: COMMAND,
        from: `import { notificationPermissions } from '${SOURCE_ALIAS}contexts/notification/application/authorization/notification.permissions${SOURCE_SUFFIX}';\n`,
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
      { file: ROUTE, where: 'start', to: "import type { CommandBus } from '@ddd-ts-kit/kernel';\n" },
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
    rule: 'authz/in-application',
    what: 'a controller that tests a role of the actor',
    file: ROUTE,
    changes: [
      {
        file: ROUTE,
        from: '    const page = await this.queries.execute(',
        to: "    if (!request.actor.roles.includes('admin')) {\n      throw new Error('Reserved to administrators.');\n    }\n\n    const page = await this.queries.execute(",
      },
    ],
    checker: true,
    eslint: 'ddd-ts-kit/authz-in-application',
  },
  {
    rule: 'authz/actor-explicit',
    what: 'a handler that reads the ambient actor instead of the one its command carries',
    file: DUE_HANDLER,
    changes: [
      { file: DUE_HANDLER, where: 'start', to: "import { ActorContext } from '@ddd-ts-kit/kernel';\n" },
      {
        file: DUE_HANDLER,
        from: '  constructor(private readonly reminderRepository: ReminderRepository) {}',
        to: '  constructor(\n    private readonly reminderRepository: ReminderRepository,\n    private readonly actors: ActorContext,\n  ) {}',
      },
      {
        file: DUE_HANDLER,
        from: '    for (const target of due) {\n',
        to: '    this.actors.require();\n\n    for (const target of due) {\n',
      },
    ],
    checker: true,
    eslint: 'ddd-ts-kit/authz-actor-explicit',
    alsoReports: [{ tool: 'checker', rule: 'declarations/barrel-current', reason: STALE }],
  },
  {
    rule: 'events/name-format',
    what: 'an integration event whose type is not <context>.<aggregate>.<fact>',
    file: PUBLISHED,
    changes: [{ file: PUBLISHED, from: "type: 'scheduling.appointment.expired',", to: "type: 'AppointmentExpired'," }],
    checker: true,
    eslint: 'ddd-ts-kit/events-name-format',
  },
  {
    rule: 'events/outbox-required',
    what: 'a command handler that publishes on the event bus, past the outbox',
    file: SEND_HANDLER,
    changes: [
      { file: SEND_HANDLER, where: 'start', to: "import { EventBus } from '@ddd-ts-kit/kernel';\n" },
      {
        file: SEND_HANDLER,
        from: '    private readonly clock: Clock,\n  ) {}',
        to: '    private readonly clock: Clock,\n    private readonly bus: EventBus,\n  ) {}',
      },
      { file: SEND_HANDLER, from: SENT, to: `${SENT}    await this.bus.publish([]);\n` },
    ],
    checker: true,
    eslint: 'ddd-ts-kit/events-outbox-required',
    alsoReports: [{ tool: 'checker', rule: 'declarations/barrel-current', reason: STALE }],
  },
  {
    rule: 'events/consumer-idempotent',
    what: 'an integration event handler declared without a consumer name',
    file: INTEGRATION_HANDLER,
    changes: [
      {
        file: INTEGRATION_HANDLER,
        from: "{ consumer: 'notification.scheduling-appointment-expired' }",
        to: '{}',
      },
    ],
    checker: true,
    eslint: 'ddd-ts-kit/events-consumer-idempotent',
    alsoReports: [
      { tool: 'checker', rule: 'declarations/role-declared', reason: CONSUMER },
      { tool: 'eslint', rule: 'ddd-ts-kit/declarations-role-declared', reason: CONSUMER },
    ],
  },
  {
    rule: 'domain-events/dispatched-on-save',
    what: 'a handler that pulls the events of the aggregate it saved',
    file: PLAN_HANDLER,
    changes: [{ file: PLAN_HANDLER, from: SAVED, to: `${SAVED}    target.pullEvents();\n` }],
    checker: true,
    eslint: 'ddd-ts-kit/domain-events-dispatched-on-save',
  },
  {
    rule: 'domain-events/transactional-before-commit',
    what: 'a before-commit domain event handler given the cache',
    file: EVENT_HANDLER,
    changes: [
      { file: EVENT_HANDLER, from: KERNEL, to: KERNEL.replace('{ ', '{ Cache, ') },
      {
        file: EVENT_HANDLER,
        from: TAKEN,
        to: '  constructor(\n    private readonly commands: CommandBus,\n    private readonly cache: Cache,\n  ) {}',
      },
    ],
    checker: true,
    eslint: 'ddd-ts-kit/domain-events-transactional-before-commit',
    alsoReports: [{ tool: 'checker', rule: 'declarations/barrel-current', reason: STALE }],
  },
  {
    rule: 'test/no-mocks',
    what: 'a spec that spies on the fake of a repository',
    file: HANDLER_SPEC,
    changes: [
      {
        file: HANDLER_SPEC,
        from: "import { describe, expect, it } from 'vitest';",
        to: "import { describe, expect, it, vi } from 'vitest';",
      },
      {
        file: HANDLER_SPEC,
        from: '  const reminderRepository = new FakeReminderRepository();\n',
        to: "  const reminderRepository = new FakeReminderRepository();\n\n  vi.spyOn(reminderRepository, 'save');\n",
      },
    ],
    checker: true,
    eslint: 'ddd-ts-kit/test-no-mocks',
  },
];
