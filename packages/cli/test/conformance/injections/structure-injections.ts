import type { Injection } from '../injection.js';
import { PATHS } from '../paths.js';
import { SOURCE_ALIAS } from '../source-alias.js';
import { SOURCE_SUFFIX } from '../source-suffix.js';

const { AGGREGATE, BARREL, BUILDER, CONFIG, CONTEXT_DOC, EVENT, HANDLER, NOTIFICATION, READER } = PATHS;
const { ROUTE, SEARCH_READER, VALUE_OBJECT, VALUE_OBJECT_SPEC } = PATHS;
const ERROR = `${NOTIFICATION}/domain/errors/contact-error.ts`;
const CHANNEL = `${NOTIFICATION}/domain/value-objects/channel.vo.ts`;
const CHANNEL_SPEC = `${NOTIFICATION}/test/unit/channel.vo.spec.ts`;
const MANAGER = `${NOTIFICATION}/domain/services/reminder-manager.service.ts`;
const SECOND = `${PATHS.SCHEDULING}/published-language/appointment-expired.v1.second.integration-event.ts`;
const DOCUMENT_HANDLER = `${PATHS.SCHEDULING}/application/queries/get-appointment-document/get-appointment-document.handler.ts`;
const TWO_EXPORTS = 'Two exported classes in one file break the rule of the role and the rule of every file at once.';

const DECLARED_TWICE = `import { defineIntegrationEvent } from '@ddd-ts-kit/events';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { AppointmentExpiredV1Payload } from '${SOURCE_ALIAS}contexts/scheduling/published-language/appointment-expired.v1.payload${SOURCE_SUFFIX}';

export const appointmentExpiredV1 = defineIntegrationEvent({
  type: 'scheduling.appointment.expired',
  version: 1,
  description: 'A requested appointment was not confirmed in time; its slot is free again.',
  payload: classSchema(AppointmentExpiredV1Payload),
});
`;

const MANAGER_SPEC = `${NOTIFICATION}/test/unit/reminder-manager.service.spec.ts`;

const SPEC_OF = (subject: string, file: string): string =>
  `import { expect, it } from 'vitest';\nimport { ${subject} } from '${SOURCE_ALIAS}${file.replace(/^src\//, '').replace(/\.ts$/, '')}${SOURCE_SUFFIX}';\n\nit('exists', () => {\n  expect(${subject}).toBeDefined();\n});\n`;

/** The tree, the names, the language, the tests and the configuration: what the checker holds alone. */
export const STRUCTURE_INJECTIONS: readonly Injection[] = [
  {
    rule: 'tree/context-doc',
    what: 'a CONTEXT.md that lost its Aggregates section',
    file: CONTEXT_DOC,
    changes: [{ file: CONTEXT_DOC, from: '## Aggregates', to: '## Model' }],
    checker: true,
  },
  {
    rule: 'naming/suffix',
    what: 'a domain error in a file without the suffix of its role',
    file: ERROR,
    changes: [
      {
        file: ERROR,
        to: "import { ConceptError } from '@ddd-ts-kit/kernel';\n\nexport class ContactError extends ConceptError {}\n",
      },
    ],
    checker: true,
  },
  {
    rule: 'naming/one-concept-per-file',
    what: 'two domain events exported by one file',
    file: EVENT,
    changes: [
      {
        file: EVENT,
        where: 'end',
        to: "\nexport class ReminderWithdrawn implements DomainEvent {\n  readonly name = 'notification.reminder.withdrawn';\n\n  constructor(\n    readonly aggregateId: string,\n    readonly occurredAt: Date,\n  ) {}\n}\n",
      },
    ],
    checker: true,
    alsoReports: [
      { tool: 'checker', rule: 'clean/one-export-per-file', reason: TWO_EXPORTS },
      { tool: 'eslint', rule: 'ddd-ts-kit/clean-one-export-per-file', reason: TWO_EXPORTS },
    ],
  },
  {
    rule: 'naming/search-not-list',
    what: 'a read port given a read by criteria named list',
    file: READER,
    changes: [
      {
        file: READER,
        from: '  abstract search(',
        to: '  abstract listByKind(kind: string): Promise<SearchNotificationsResult>;\n\n  abstract search(',
      },
    ],
    checker: true,
  },
  {
    rule: 'test/spec-required',
    what: 'a value object whose spec was removed',
    file: VALUE_OBJECT,
    changes: [],
    removes: [VALUE_OBJECT_SPEC],
    checker: true,
  },
  {
    rule: 'test/builder-required',
    what: 'an aggregate whose builder was removed',
    file: AGGREGATE,
    changes: [],
    removes: [BUILDER],
    checker: true,
  },
  {
    rule: 'test/coverage-governed',
    what: 'an aggregate left out of the coverage measure by a comment, without a decision record',
    file: AGGREGATE,
    changes: [{ file: AGGREGATE, where: 'start', to: '/* v8 ignore file */\n' }],
    checker: true,
  },
  {
    rule: 'events/defined-in-published-language',
    what: 'the same version of an integration event declared a second time',
    file: SECOND,
    changes: [{ file: SECOND, to: DECLARED_TWICE }],
    checker: true,
  },
  {
    rule: 'language/glossary-term',
    what: 'a value object named with a word the glossary of its context does not hold',
    file: CHANNEL,
    changes: [
      {
        file: CHANNEL,
        to: "import { ValueObject } from '@ddd-ts-kit/kernel';\n\nexport class Channel extends ValueObject<{ readonly value: string }> {\n  static create(value: string): Channel {\n    return new Channel({ value });\n  }\n}\n",
      },
      { file: CHANNEL_SPEC, to: SPEC_OF('Channel', CHANNEL) },
    ],
    checker: true,
  },
  {
    rule: 'language/declared-vocabulary',
    what: 'a status of the reminder written as a string where its vocabulary declares it',
    file: AGGREGATE,
    changes: [
      {
        file: AGGREGATE,
        from: 'status: ReminderStatus.Withdrawn };',
        to: "status: 'withdrawn' };",
      },
    ],
    checker: true,
    eslint: 'ddd-ts-kit/language-declared-vocabulary',
  },
  {
    rule: 'language/no-technical-name',
    what: 'a domain service named Manager',
    file: MANAGER,
    changes: [
      {
        file: MANAGER,
        to: 'export class ReminderManager {\n  isDue(dueAt: Date, asOf: Date): boolean {\n    return dueAt.getTime() <= asOf.getTime();\n  }\n}\n',
      },
      { file: MANAGER_SPEC, to: SPEC_OF('ReminderManager', MANAGER) },
    ],
    checker: true,
    alsoReports: [
      {
        tool: 'checker',
        rule: 'language/glossary-term',
        reason: 'A technical word is a term of no glossary: the name breaks both rules of the language.',
      },
    ],
  },
  {
    rule: 'declarations/barrel-current',
    what: 'a barrel that no longer lists a handler of its context',
    file: BARREL,
    changes: [
      {
        file: BARREL,
        from: `export * from '${SOURCE_ALIAS}contexts/notification/application/commands/withdraw-reminder/withdraw-reminder.handler${SOURCE_SUFFIX}';\n`,
        to: '',
      },
    ],
    checker: true,
  },
  {
    rule: 'composition/only-in-module',
    what: 'a route file that assembles the declared classes of its context',
    file: ROUTE,
    changes: [
      { file: ROUTE, where: 'start', to: "import { contextModule } from '@ddd-ts-kit/di';\n" },
      { file: ROUTE, where: 'end', to: "\nexport const assembled = contextModule('notification', {});\n" },
    ],
    checker: true,
  },
  {
    rule: 'imports/alias-declared',
    what: 'a second entry under the alias in the paths of tsconfig.json',
    file: 'tsconfig.json',
    changes: [
      {
        file: 'tsconfig.json',
        from: '    "paths": {',
        to: `    "paths": {\n      "${SOURCE_ALIAS}kernel/*": ["./src/shared-kernel/*"],`,
      },
    ],
    checker: true,
  },
  {
    rule: 'config/valid',
    what: 'a relationship between two contexts that does not exist',
    file: CONFIG,
    changes: [{ file: CONFIG, from: '"relationship": "customer-supplier"', to: '"relationship": "customer"' }],
    checker: true,
  },
  {
    rule: 'config/suppression-needs-reason',
    what: 'a suppression that gives no reason',
    file: HANDLER,
    changes: [
      {
        file: HANDLER,
        from: '    target.withdraw();\n',
        to: '    // ddd-ts-kit-disable-next-line domain-events/dispatched-on-save\n    target.withdraw();\n',
      },
    ],
    checker: true,
    alsoReports: [
      {
        tool: 'eslint',
        rule: 'ddd-ts-kit/governance-recorded-deviation',
        reason:
          'ESLint holds no rule for the form of a kit directive: its governance rule reports any directive without a decision record, with or without a reason, where the checker reports the missing reason once.',
      },
    ],
  },
  {
    rule: 'persistence/migration-history',
    what: 'a migration written by hand, without the timestamp that orders it',
    file: 'migrations/add-appointment-note.js',
    changes: [
      {
        file: 'migrations/add-appointment-note.js',
        to: [
          'export const up = async (knex) => {',
          "  await knex.schema.alterTable('appointments', (table) => {",
          "    table.text('note');",
          '  });',
          '};',
          '',
          'export const down = async (knex) => {',
          "  await knex.schema.alterTable('appointments', (table) => {",
          "    table.dropColumn('note');",
          '  });',
          '};',
          '',
        ].join('\n'),
      },
    ],
    checker: true,
  },
  {
    rule: 'tenancy/scoped-statement',
    what: 'a statement of a reader that reaches its table straight from the executor, outside the network of the work',
    file: SEARCH_READER,
    changes: [
      {
        file: SEARCH_READER,
        from: '    private readonly execution: ExecutionScope,\n  ) {}\n',
        to: [
          '    private readonly execution: ExecutionScope,',
          '  ) {}',
          '',
          '  async total(): Promise<number> {',
          '    const rows = await this.database',
          "      .executor()<NotificationRow, NotificationRow[]>('notifications')",
          '      .withSchema(NOTIFICATION_SCHEMA);',
          '',
          '    return rows.length;',
          '  }',
          '',
        ].join('\n'),
      },
    ],
    checker: true,
  },
  {
    rule: 'persistence/no-file-content',
    what: 'a migration that adds a column of bytes for the scan of an appointment',
    file: 'migrations/20261013120000_add-appointment-scan.js',
    changes: [
      {
        file: 'migrations/20261013120000_add-appointment-scan.js',
        to: [
          'export const up = async (knex) => {',
          "  await knex.schema.withSchema('scheduling').alterTable('appointments', (table) => {",
          "    table.binary('scan');",
          '  });',
          '};',
          '',
          'export const down = async (knex) => {',
          "  await knex.schema.withSchema('scheduling').alterTable('appointments', (table) => {",
          "    table.dropColumn('scan');",
          '  });',
          '};',
          '',
        ].join('\n'),
      },
    ],
    checker: true,
  },
  {
    rule: 'files/port-not-connector',
    what: 'a query handler that names the local connector instead of the FileStorage port',
    file: DOCUMENT_HANDLER,
    changes: [
      {
        file: DOCUMENT_HANDLER,
        from: "import type { FileStorage } from '@ddd-ts-kit/kernel';",
        to: "import type { LocalFileStorage } from '@ddd-ts-kit/kernel';",
      },
      {
        file: DOCUMENT_HANDLER,
        from: 'private readonly files: FileStorage,',
        to: 'private readonly files: LocalFileStorage,',
      },
    ],
    checker: true,
    alsoReports: [
      {
        tool: 'checker',
        rule: 'declarations/barrel-current',
        reason: 'the constructor names another class than the list the generated file of the context registers for it',
      },
    ],
  },
];
