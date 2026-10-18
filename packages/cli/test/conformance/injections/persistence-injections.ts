import type { Injection } from '../injection.js';
import { PATHS } from '../paths.js';

const { CONFIG } = PATHS;

/** The migrations of the project: their order, the order of a change of key, no file content. */
export const PERSISTENCE_INJECTIONS: readonly Injection[] = [
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
    rule: 'persistence/primary-key-order',
    what: 'a drizzle-kit migration that adds the new primary key of a table before dropping the old one',
    file: 'migrations/20261014090000_change-reminder-key.sql',
    changes: [
      { file: CONFIG, from: '"orm": "knex"', to: '"orm": "drizzle"' },
      {
        file: 'migrations/20261014090000_change-reminder-key.sql',
        to: [
          'ALTER TABLE "reminders" ADD CONSTRAINT "reminders_id_channel_pk" PRIMARY KEY("id","channel");--> statement-breakpoint',
          'ALTER TABLE "reminders" DROP CONSTRAINT "reminders_pkey";',
          '',
        ].join('\n'),
      },
    ],
    checker: true,
  },
  {
    rule: 'persistence/no-file-content',
    // Numbered after every real migration, so that the history stays in order and only this rule speaks.
    what: 'a migration that adds a column of bytes for the scan of an appointment',
    file: 'migrations/29991231235959_add-appointment-scan.js',
    changes: [
      {
        file: 'migrations/29991231235959_add-appointment-scan.js',
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
];
