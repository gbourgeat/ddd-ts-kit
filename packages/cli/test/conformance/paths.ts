const NOTIFICATION = 'src/contexts/notification';
const SCHEDULING = 'src/contexts/scheduling';
const COMMANDS = `${NOTIFICATION}/application/commands`;
const WITHDRAW = `${COMMANDS}/withdraw-reminder`;
const SEARCH = `${NOTIFICATION}/application/queries/search-notifications`;

/** The files of the example the injections write into, and their alias where another file names them. */
export const PATHS = {
  CONFIG: 'ddd-ts-kit.config.json',
  MANIFEST: 'package.json',
  NOTIFICATION,
  SCHEDULING,
  ANALYTICS: 'src/contexts/analytics',
  CONTEXT_DOC: `${NOTIFICATION}/CONTEXT.md`,
  /** The generated declarations of the role folder the commands of the context sit in. */
  COMMANDS_DECLARATIONS: `${NOTIFICATION}/application/commands/commands.declarations.ts`,
  AGGREGATE: `${NOTIFICATION}/domain/aggregates/reminder.aggregate.ts`,
  SENT_AGGREGATE: `${NOTIFICATION}/domain/aggregates/notification.aggregate.ts`,
  VALUE_OBJECT: `${NOTIFICATION}/domain/value-objects/notification-kind.vo.ts`,
  VALUE_OBJECT_SPEC: `${NOTIFICATION}/test/unit/notification-kind.vo.spec.ts`,
  EVENT: `${NOTIFICATION}/domain/events/reminder-sent.event.ts`,
  COMMAND: `${WITHDRAW}/withdraw-reminder.command.ts`,
  HANDLER: `${WITHDRAW}/withdraw-reminder.handler.ts`,
  PLAN_HANDLER: `${COMMANDS}/plan-reminder/plan-reminder.handler.ts`,
  DUE_HANDLER: `${COMMANDS}/send-due-reminders/send-due-reminders.handler.ts`,
  SEND_HANDLER: `${COMMANDS}/send-notification/send-notification.handler.ts`,
  HANDLER_SPEC: `${NOTIFICATION}/test/unit/withdraw-reminder.handler.spec.ts`,
  QUERY_HANDLER: `${SEARCH}/search-notifications.handler.ts`,
  EVENT_HANDLER: `${NOTIFICATION}/application/event-handlers/reminder-sent.event-handler.ts`,
  INTEGRATION_HANDLER: `${NOTIFICATION}/application/integration/handlers/scheduling-appointment-expired.integration-handler.ts`,
  JOB: `${NOTIFICATION}/application/scheduling/send-due-reminders.job.ts`,
  PORT: `${NOTIFICATION}/application/ports/mailer.port.ts`,
  READER: `${NOTIFICATION}/application/ports/search-notifications-reader.port.ts`,
  ADAPTER: `${NOTIFICATION}/infrastructure/external/remote-mailer.adapter.ts`,
  REPOSITORY: `${NOTIFICATION}/infrastructure/persistence/knex-contacts.repository.ts`,
  SEARCH_READER: `${NOTIFICATION}/infrastructure/persistence/knex-search-notifications-reader.repository.ts`,
  ROUTE: `${NOTIFICATION}/presentation/http/notifications/search-notifications/search-notifications.controller.ts`,
  OCCUPANCY_ROUTE: 'src/contexts/analytics/presentation/http/practices/search-occupancy/search-occupancy.controller.ts',
  BUILDER: `${NOTIFICATION}/test/builders/reminder.builder.ts`,
  PUBLISHED: `${SCHEDULING}/published-language/appointment-expired.v1.integration-event.ts`,
  PUBLISHER: `${SCHEDULING}/application/calendars/integration/publishers/appointment-expired.publisher.ts`,
  POLICY: 'src/platform/resilience/own-policy.ts',
} as const;
