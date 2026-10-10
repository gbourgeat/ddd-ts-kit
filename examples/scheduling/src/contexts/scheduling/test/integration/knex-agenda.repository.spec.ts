import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Criteria, offsetPage, scoped, unwrap } from '@ddd-ts-kit/kernel';
import type { AgendaEntry } from '../../application/ports/agenda.port.js';
import { AgendaProjection } from '../../application/projections/agenda.projection.js';
import { AppointmentBooked } from '../../domain/events/appointment-booked.event.js';
import { AppointmentCancelled } from '../../domain/events/appointment-cancelled.event.js';
import { Cancellation } from '../../domain/value-objects/cancellation.vo.js';
import { KnexAgenda } from '../../infrastructure/persistence/knex-agenda.repository.js';
import { openTestDatabase, type TestDatabase } from '../../../../platform/database/open-test-database.js';
import { anAgendaEntry } from '../builders/agenda-entry.builder.js';
import { anAppointment } from '../builders/appointment.builder.js';

const everything = Criteria.of<AgendaEntry>();

let database: TestDatabase;
let agenda: KnexAgenda;

beforeAll(async () => {
  database = await openTestDatabase();
});

afterAll(async () => {
  await database.close();
});

beforeEach(async () => {
  await database.reset();
  agenda = new KnexAgenda(database.persistence.database);
});

describe('KnexAgenda', () => {
  it('reads back every fact of a requested appointment it was given', async () => {
    const requested = anAgendaEntry().withMany({ id: 'appointment-1', heldUntil: at('09:40'), status: 'requested', confirmBefore: at('08:00') }).build();

    await write(requested);

    expect(await agenda.get('appointment-1')).toEqual(requested);
  });

  it('reads back who cancelled, and nothing where nothing is known', async () => {
    const cancelled = anAgendaEntry().withMany({ id: 'appointment-1', status: 'cancelled', cancelledBy: 'practice' }).build();

    await write(cancelled);

    expect(await agenda.get('appointment-1')).toMatchObject({ status: 'cancelled', cancelledBy: 'practice', confirmBefore: null });
  });

  it('lists by start, then by identifier, page by page with the total', async () => {
    await write(anAgendaEntry().withMany({ id: 'appointment-c', startsAt: at('10:00') }).build());
    await write(anAgendaEntry().withMany({ id: 'appointment-b', startsAt: at('09:00') }).build());
    await write(anAgendaEntry().withMany({ id: 'appointment-a', startsAt: at('09:00') }).build());

    const page = await agenda.list(scoped(everything.page(offsetPage({ limit: 2 })), { kind: 'all' }));

    expect(page.items.map((entry) => entry.id)).toEqual(['appointment-a', 'appointment-b']);
    expect(page.total).toBe(3);
  });

  it('narrows a list, in the statement, to the appointments or to the calendars of the scope of the actor', async () => {
    await write(anAgendaEntry().withMany({ id: 'appointment-a', calendarId: 'calendar-a' }).build());
    await write(anAgendaEntry().withMany({ id: 'appointment-b', calendarId: 'calendar-b' }).build());
    await write(anAgendaEntry().withMany({ id: 'appointment-c', calendarId: 'calendar-a' }).build());

    const own = await agenda.list(scoped(everything, { kind: 'ids', ids: ['appointment-b', 'appointment-c'] }, { ids: 'id' }));
    const run = await agenda.list(scoped(everything, { kind: 'ids', ids: ['calendar-a'] }, { ids: 'calendarId' }));
    const none = await agenda.list(scoped(everything, { kind: 'none' }, { ids: 'id' }));

    expect(own.items.map((entry) => entry.id)).toEqual(['appointment-b', 'appointment-c']);
    expect(run.items.map((entry) => entry.id)).toEqual(['appointment-a', 'appointment-c']);
    expect(none.items).toEqual([]);
  });

  it('filters by the day of the practice, by status and by a span of starts', async () => {
    await write(anAgendaEntry().withMany({ id: 'appointment-a', day: '2026-03-02', startsAt: at('09:00'), status: 'booked' }).build());
    await write(anAgendaEntry().withMany({ id: 'appointment-b', day: '2026-03-02', startsAt: at('11:00'), status: 'cancelled', cancelledBy: 'patient' }).build());
    await write(anAgendaEntry().withMany({ id: 'appointment-c', day: '2026-03-03', startsAt: new Date('2026-03-03T09:00:00.000Z'), status: 'requested', confirmBefore: at('08:00') }).build());

    const monday = await agenda.list(scoped(everything.where('day', 'eq', '2026-03-02'), { kind: 'all' }));
    const active = await agenda.list(scoped(everything.where('status', 'in', ['booked', 'requested']), { kind: 'all' }));
    const fromTen = await agenda.list(scoped(everything.where('startsAt', 'gte', at('10:00')).where('day', 'lte', '2026-03-02'), { kind: 'all' }));
    const unconfirmed = await agenda.list(scoped(everything.where('confirmBefore', 'isNull', false), { kind: 'all' }));

    expect(monday.items.map((entry) => entry.id)).toEqual(['appointment-a', 'appointment-b']);
    expect(active.items.map((entry) => entry.id)).toEqual(['appointment-a', 'appointment-c']);
    expect(fromTen.items.map((entry) => entry.id)).toEqual(['appointment-b']);
    expect(unconfirmed.items.map((entry) => entry.id)).toEqual(['appointment-c']);
  });

  // The stamps of real facts carry milliseconds, which the store reads back to the second: the projection orders them itself.
  it('follows the facts of an appointment the projection applies, milliseconds apart', async () => {
    const projection = new AgendaProjection(agenda);
    const { booking } = anAppointment().identifiedBy('appointment-1').build();
    const cancellation = unwrap(Cancellation.create('patient'));

    const writes = [
      await projection.booked(new AppointmentBooked('appointment-1', new Date('2026-03-01T08:00:00.123Z'), { booking })),
      await projection.cancelled(new AppointmentCancelled('appointment-1', new Date('2026-03-01T08:00:00.456Z'), { booking, cancellation })),
      await projection.booked(new AppointmentBooked('appointment-1', new Date('2026-03-01T08:00:00.123Z'), { booking })),
    ];

    expect(writes).toEqual(['applied', 'applied', 'stale']);
    expect(await agenda.get('appointment-1')).toMatchObject({ status: 'cancelled', cancelledBy: 'patient', changedAt: new Date('2026-03-01T08:00:00.456Z') });
  });

  it('keeps the entry of a later fact when an older one is delivered late', async () => {
    const booked = anAgendaEntry().withMany({ id: 'appointment-1', status: 'booked' }).build();

    await agenda.upsertIfNewer('appointment-1', { eventId: 'cancelled', occurredAt: at('10:00') }, () => ({ ...booked, status: 'cancelled', cancelledBy: 'patient' }));

    const late = await agenda.upsertIfNewer('appointment-1', { eventId: 'booked', occurredAt: at('09:00') }, () => booked);

    expect(late).toBe('stale');
    expect(await agenda.get('appointment-1')).toMatchObject({ status: 'cancelled' });
  });
});

async function write(entry: AgendaEntry): Promise<void> {
  await agenda.upsertIfNewer(entry.id, { eventId: 'event-of-' + entry.id, occurredAt: entry.changedAt }, () => entry);
}

function at(time: string): Date {
  return new Date(`2026-03-02T${time}:00.000Z`);
}
