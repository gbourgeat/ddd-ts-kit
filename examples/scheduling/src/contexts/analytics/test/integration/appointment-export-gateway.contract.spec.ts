import { describe, expect, it } from 'vitest';
import type { ExportedAppointment } from '../../../scheduling/published-language/index.js';
import type { AppointmentExportGateway } from '../../application/ports/appointment-export-gateway.port.js';
import type { Outcome } from '../../application/ports/outcome-register.port.js';
import { InProcessAppointmentExportGateway } from '../../infrastructure/external/in-process-appointment-export.gateway.js';
import { anOutcome } from '../builders/outcome.builder.js';
import { FakeAppointmentExportContract } from '../fakes/appointment-export-contract.fake.js';
import { FakeAppointmentExportGateway } from '../fakes/appointment-export-gateway.fake.js';

const OUTCOMES: readonly Outcome[] = [
  anOutcome({ id: 'appointment-1', state: 'completed', changedAt: new Date('2026-10-12T09:00:00.000Z') }),
  anOutcome({ id: 'appointment-2', state: 'cancelled-by-practice' }),
  anOutcome({ id: 'appointment-3', calendarId: 'calendar-2', day: '2026-10-13' }),
];

const ADAPTERS: readonly (readonly [string, () => AppointmentExportGateway])[] = [
  ['the fake', () => new FakeAppointmentExportGateway(OUTCOMES)],
  [
    'the in-process adapter',
    () => new InProcessAppointmentExportGateway(new FakeAppointmentExportContract(OUTCOMES.map(asScheduling))),
  ],
];

describe.each(ADAPTERS)('AppointmentExportGateway, %s', (_name, create) => {
  it('is an adapter of the port', () => {
    expect(create()).toBeDefined();
  });

  it('answers every appointment scheduling holds as an outcome, page after page', async () => {
    const gateway = create();

    const first = await gateway.export(undefined);
    const second = await gateway.export(first.nextCursor);

    expect([...first.items, ...second.items].map((exported) => exported.row)).toEqual(OUTCOMES);
    expect(second.nextCursor).toBeUndefined();
  });

  it('stamps each outcome with the instant scheduling last changed the appointment', async () => {
    const page = await create().export(undefined);

    expect(page.items[0]).toMatchObject({
      key: 'appointment-1',
      stamp: { occurredAt: new Date('2026-10-12T09:00:00.000Z') },
    });
  });

  it('answers the outcomes of the appointments asked for, as they are now', async () => {
    const found = await create().lookup(['appointment-2']);

    expect([...found.keys()]).toEqual(['appointment-2']);
    expect(found.get('appointment-2')?.row).toEqual(OUTCOMES[1]);
  });

  it('answers nothing, without failing, for an appointment scheduling does not know', async () => {
    const found = await create().lookup(['appointment-unknown']);

    expect(found.size).toBe(0);
  });
});

function asScheduling(outcome: Outcome): ExportedAppointment {
  return {
    appointmentId: outcome.id,
    calendarId: outcome.calendarId,
    practiceId: outcome.practiceId,
    startsAt: outcome.startsAt.toISOString(),
    endsAt: outcome.endsAt.toISOString(),
    day: outcome.day,
    outcome: outcome.state,
    changedAt: outcome.changedAt.toISOString(),
  };
}
