import type { Injection } from '../injection.js';
import { PATHS } from '../paths.js';

const {
  DUE_HANDLER,
  EVENT,
  EVENT_HANDLER,
  HANDLER_SPEC,
  INTEGRATION_HANDLER,
  PLAN_HANDLER,
  SEND_HANDLER,
  PUBLISHED,
  ROUTE,
  SCHEDULING,
} = PATHS;

const SENT = '    await this.notificationRepository.save(notification);\n';

const CONSUMER =
  'The consumer name is held twice, as part of the declaration of the role and as the idempotency scope: both rules report its absence.';

const AGENDA_HANDLER = `${SCHEDULING}/application/queries/search-practice-agenda/search-practice-agenda.handler.ts`;
const CANCEL_HANDLER = `${SCHEDULING}/application/commands/cancel-appointment/cancel-appointment.handler.ts`;
const SAVED = '    await this.reminderRepository.save(reminder);\n';
const TAKEN = '  constructor(private readonly commands: CommandBus) {}';

const STALE =
  'The generated list of a class is read from its constructor: a changed signature leaves the barrel stale until it is regenerated.';

const KERNEL = "import { type CommandBus, systemActor } from '@ddd-ts-kit/kernel';";

/** What the use cases decide and publish: authorization, events, tests. */
export const AUTHZ_AND_EVENT_INJECTIONS: readonly Injection[] = [
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
    rule: 'authz/fields-by-schema',
    what: 'a query that answers the agenda of a practice to its staff only, by role',
    file: AGENDA_HANDLER,
    changes: [
      {
        file: AGENDA_HANDLER,
        from: "    const scope = await this.access.scope(query.actor, schedulingPermissions['agenda.read'], 'calendar');\n",
        to: "    if (!query.actor.roles.includes('practitioner')) {\n      return { items: [] };\n    }\n\n    const scope = await this.access.scope(query.actor, schedulingPermissions['agenda.read'], 'calendar');\n",
      },
    ],
    checker: true,
    eslint: 'ddd-ts-kit/authz-fields-by-schema',
  },
  {
    rule: 'authz/policy-asked',
    what: 'a handler of cancel-appointment that asks Access about another permission than the one its policy refines',
    file: CANCEL_HANDLER,
    changes: [
      {
        file: CANCEL_HANDLER,
        from: "schedulingPermissions['appointment.cancel'], appointment);",
        to: "schedulingPermissions['appointment.read'], appointment);",
      },
    ],
    checker: true,
  },
  {
    rule: 'authz/granted',
    what: 'the example moved to roles, with roles that hold every context but scheduling by name',
    file: `${SCHEDULING}/application/authorization/scheduling.permissions.ts`,
    changes: [
      { file: 'ddd-ts-kit.config.json', from: '"authz": "rebac"', to: '"authz": "rbac"' },
      {
        file: 'src/platform/auth/roles.ts',
        to: "/** What each role may do: every context but scheduling, whose permissions nobody holds by name. */\nexport const roles: Readonly<Record<string, readonly string[]>> = {\n  admin: ['*'],\n  staff: ['identity:*', 'notification:*', 'analytics:*'],\n};\n",
      },
    ],
    checker: true,
  },
  {
    rule: 'authz/scope-narrows',
    what: 'a permission every signed-in person holds, which a search of notification narrows by',
    file: 'src/contexts/notification/application/queries/search-notifications/search-notifications.handler.ts',
    changes: [
      {
        file: 'src/platform/auth/signed-in-grants.ts',
        to: "import type { Grant } from '@ddd-ts-kit/auth';\nimport { notificationPermissions } from '@/contexts/notification/application/authorization/notification.permissions';\n\n/** What every signed-in person may do, whatever the model decides: here, read every notification. */\nexport const signedInGrants: readonly Grant[] = [notificationPermissions['notification.read']];\n",
      },
    ],
    checker: true,
  },
  {
    rule: 'authz/actor-explicit',
    what: 'a handler that reads the ambient actor instead of the one its command carries',
    file: DUE_HANDLER,
    changes: [
      {
        file: DUE_HANDLER,
        where: 'start',
        to: "import { ActorContext } from '@ddd-ts-kit/kernel';\n",
      },
      {
        file: DUE_HANDLER,
        from: '  constructor(private readonly reminderRepository: ReminderRepository) {}',
        to: '  constructor(\n    private readonly reminderRepository: ReminderRepository,\n    private readonly actors: ActorContext,\n  ) {}',
      },
      {
        file: DUE_HANDLER,
        from: '    for (const reminder of due) {\n',
        to: '    this.actors.require();\n\n    for (const reminder of due) {\n',
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
    changes: [
      {
        file: PUBLISHED,
        from: "type: 'scheduling.appointment.expired',",
        to: "type: 'AppointmentExpired',",
      },
    ],
    checker: true,
    eslint: 'ddd-ts-kit/events-name-format',
  },
  {
    rule: 'events/name-declared-once',
    what: 'a domain event that writes its name a second time instead of reading its eventName',
    file: EVENT,
    changes: [
      {
        file: EVENT,
        from: '  readonly name = ReminderSent.eventName;',
        to: "  readonly name = 'notification.reminder.sent';",
      },
    ],
    checker: true,
  },
  {
    rule: 'events/outbox-required',
    what: 'a command handler that publishes on the event bus, past the outbox',
    file: SEND_HANDLER,
    changes: [
      {
        file: SEND_HANDLER,
        where: 'start',
        to: "import { EventBus } from '@ddd-ts-kit/kernel';\n",
      },
      {
        file: SEND_HANDLER,
        from: '    private readonly clock: Clock,\n  ) {}',
        to: '    private readonly clock: Clock,\n    private readonly bus: EventBus,\n  ) {}',
      },
      {
        file: SEND_HANDLER,
        from: SENT,
        to: `${SENT}    await this.bus.publish([]);\n`,
      },
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
      {
        tool: 'eslint',
        rule: 'ddd-ts-kit/declarations-role-declared',
        reason: CONSUMER,
      },
    ],
  },
  {
    rule: 'domain-events/dispatched-on-save',
    what: 'a handler that pulls the events of the aggregate it saved',
    file: PLAN_HANDLER,
    changes: [
      {
        file: PLAN_HANDLER,
        from: SAVED,
        to: `${SAVED}    reminder.pullEvents();\n`,
      },
    ],
    checker: true,
    eslint: 'ddd-ts-kit/domain-events-dispatched-on-save',
  },
  {
    rule: 'domain-events/transactional-before-commit',
    what: 'a before-commit domain event handler given the cache',
    file: EVENT_HANDLER,
    changes: [
      {
        file: EVENT_HANDLER,
        from: KERNEL,
        to: KERNEL.replace('{ ', '{ Cache, '),
      },
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
        from: "  return aNotificationWorld({\n    modules: [holders],\n    idPrefix: 'reminder',\n  });\n",
        to: "  const world = await aNotificationWorld({\n    modules: [holders],\n    idPrefix: 'reminder',\n  });\n\n  vi.spyOn(world.reminderRepository, 'save');\n\n  return world;\n",
      },
    ],
    checker: true,
    eslint: 'ddd-ts-kit/test-no-mocks',
  },
];
