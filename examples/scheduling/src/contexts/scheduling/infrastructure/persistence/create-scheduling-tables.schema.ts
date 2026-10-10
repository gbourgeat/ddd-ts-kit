// ddd-ts-kit:imports
import type { Knex } from 'knex';
import { SCHEDULING_SCHEMA } from '@/contexts/scheduling/infrastructure/persistence/scheduling.schema.js';
import { APPOINTMENT_SLOT_HELD_ONCE } from '@/contexts/scheduling/infrastructure/persistence/appointment-row.schema.js';
import { auditColumns, readModelColumns } from '@ddd-ts-kit/knex';
// /ddd-ts-kit:imports

export async function createSchedulingTables(knex: Knex): Promise<void> {
  await knex.schema.createSchemaIfNotExists(SCHEDULING_SCHEMA);
  // ddd-ts-kit:tables
  await createCalendarTable(knex);
  await createAppointmentTable(knex);
  await createWaitlistTable(knex);
  // /ddd-ts-kit:tables
  await createAgendaTable(knex);
  await createPractitionerTable(knex);
}

// ddd-ts-kit:definitions
function createCalendarTable(knex: Knex): Promise<void> {
  return knex.schema.withSchema(SCHEDULING_SCHEMA).createTable('calendars', (table) => {
    table.text('id').primary();
    table.timestamp('registered_at', { useTz: true }).notNullable();
    table.text('practice_id').notNullable();
    table.text('practitioner_id').notNullable();
    table.text('time_zone').notNullable();
    table.text('opening_hours').notNullable();
    table.text('exceptions').notNullable();
    table.text('time_offs').notNullable();
    table.text('appointment_types').notNullable();
    table.integer('notice').notNullable();
    table.integer('horizon').notNullable();
    table.integer('patient_limit').notNullable();
    table.index(['practice_id', 'practitioner_id']);
    table.integer('version').notNullable();
    auditColumns(table);
  });
}

async function createAppointmentTable(knex: Knex): Promise<void> {
  await knex.raw('create extension if not exists btree_gist');

  await knex.schema.withSchema(SCHEDULING_SCHEMA).createTable('appointments', (table) => {
    table.text('id').primary();
    table.timestamp('registered_at', { useTz: true }).notNullable();
    table.timestamp('changed_at', { useTz: true }).notNullable();
    table.text('calendar_id').notNullable();
    table.text('practice_id').notNullable();
    table.text('practitioner_id').notNullable();
    table.text('patient_id').notNullable();
    table.text('appointment_type_id').notNullable();
    table.timestamp('starts_at', { useTz: true }).notNullable();
    table.timestamp('ends_at', { useTz: true }).notNullable();
    table.timestamp('held_until', { useTz: true }).notNullable();
    table.text('day').notNullable();
    table.text('status').notNullable();
    table.timestamp('confirm_before', { useTz: true });
    table.text('cancelled_by');
    table.text('cancellation_reason');

    table.check(
      "status in ('requested', 'booked', 'cancelled', 'expired', 'completed', 'no-show')",
      [],
      'appointments_status_known',
    );

    table.check('starts_at < ends_at and ends_at <= held_until', [], 'appointments_slot_ordered');
    table.index(['patient_id', 'practitioner_id', 'starts_at']);
    table.index(['status', 'confirm_before']);
    table.integer('version').notNullable();
    auditColumns(table);
  });

  await holdEachSlotOnce(knex);
}

/**
 * A time on a calendar is held once: this constraint is the guard, and the only one. Two transactions that both read
 * a free slot cannot both write it, whatever each believed when it checked. A lock (Redis or any other) is no
 * substitute: a paused holder, a failover or an eviction gives two holders, which wastes work but must never book twice.
 */
async function holdEachSlotOnce(knex: Knex): Promise<void> {
  await knex.raw(
    `alter table ??.?? add constraint ${APPOINTMENT_SLOT_HELD_ONCE} exclude using gist (calendar_id with =, tstzrange(starts_at, held_until, '[)') with &&) where (status in ('requested', 'booked'))`,
    [SCHEDULING_SCHEMA, 'appointments'],
  );
}

function createWaitlistTable(knex: Knex): Promise<void> {
  return knex.schema.withSchema(SCHEDULING_SCHEMA).createTable('waitlists', (table) => {
    table.text('id').primary();
    table.timestamp('registered_at', { useTz: true }).notNullable();
    table.text('calendar_id').notNullable();
    table.text('day').notNullable();
    table.text('waiters').notNullable();
    table.unique(['calendar_id', 'day']);
    table.integer('version').notNullable();
    auditColumns(table);
  });
}
// /ddd-ts-kit:definitions

/** The read model of the practitioners known from identity, under the key `<practiceId>.<practitionerId>`. */
function createPractitionerTable(knex: Knex): Promise<void> {
  return knex.schema.withSchema(SCHEDULING_SCHEMA).createTable('practitioners', (table) => {
    table.text('id').primary();
    table.text('practice_id').notNullable();
    table.text('practitioner_id').notNullable();
    table.specificType('display_name', 'text COLLATE "C"').notNullable();
    table.text('time_zone').notNullable();
    readModelColumns(table);
  });
}

/** The read model of the agenda: one row per appointment, as its last fact left it. */
function createAgendaTable(knex: Knex): Promise<void> {
  return knex.schema.withSchema(SCHEDULING_SCHEMA).createTable('agenda', (table) => {
    table.text('id').primary();
    table.text('calendar_id').notNullable();
    table.text('practice_id').notNullable();
    table.text('practitioner_id').notNullable();
    table.text('patient_id').notNullable();
    table.text('appointment_type_id').notNullable();
    table.datetime('starts_at', { useTz: true, precision: 3 }).notNullable();
    table.datetime('ends_at', { useTz: true, precision: 3 }).notNullable();
    table.datetime('held_until', { useTz: true, precision: 3 }).notNullable();
    table.specificType('day', 'text COLLATE "C"').notNullable();
    table.text('status').notNullable();
    table.datetime('confirm_before', { useTz: true, precision: 3 });
    table.text('cancelled_by');
    table.datetime('changed_at', { useTz: true, precision: 3 }).notNullable();
    table.index(['calendar_id', 'day']);
    table.index(['practice_id', 'day']);
    table.index(['patient_id', 'starts_at']);
    readModelColumns(table);
  });
}
