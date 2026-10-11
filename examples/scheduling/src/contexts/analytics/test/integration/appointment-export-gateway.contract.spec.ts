import { describe, expect, it } from 'vitest';
import type { ExportedAppointment } from '@/contexts/scheduling/published-language/index';
import type { AppointmentExportGateway } from '@/contexts/analytics/application/ports/appointment-export-gateway.port';
import type { Outcome } from '@/contexts/analytics/application/ports/outcome-register.port';
import { InProcessAppointmentExportGateway } from '@/contexts/analytics/infrastructure/external/in-process-appointment-export.gateway';
import { anOutcome } from '@/contexts/analytics/test/builders/outcome.builder';
import { FakeAppointmentExportContract } from '@/contexts/analytics/test/fakes/appointment-export-contract.fake';
import { FakeAppointmentExportGateway } from '@/contexts/analytics/test/fakes/appointment-export-gateway.fake';

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
