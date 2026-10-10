import { describe, expect, it } from 'vitest';
import { contextModule, createTestApplication, fake } from '@ddd-ts-kit/di';
import { platformTestModule } from '../../../../platform/platform-test.module.js';
import { appointmentBookedV1, appointmentCancelledV1, appointmentCompletedV1, appointmentRescheduledV1 } from '../../../scheduling/published-language/index.js';
import { OccupancyRegister } from '../../application/ports/occupancy-register.port.js';
import { OutcomeRegister } from '../../application/ports/outcome-register.port.js';
import { OccupancyProjection } from '../../application/projections/occupancy.projection.js';
import { OutcomesProjection } from '../../application/projections/outcomes.projection.js';
import { anAppointmentFact } from '../builders/appointment-fact.builder.js';
import { FakeOccupancyRegister } from '../fakes/occupancy-register.fake.js';
import { FakeOutcomeRegister } from '../fakes/outcome-register.fake.js';

const first = anAppointmentFact();
const second = anAppointmentFact({ appointmentId: 'appointment-2', startsAt: '2026-10-12T09:00:00.000Z', endsAt: '2026-10-12T09:45:00.000Z' });
const bothProjections = { OutcomesProjection, OccupancyProjection };

describe('The occupancy of a calendar on a day', () => {
  it('holds the time of an appointment once it is booked', async () => {
    const { application, occupancy } = await arrange(bothProjections);

    await application.eventBus.publish([appointmentBookedV1.create({ ...first, status: 'booked' }, at('00'))]);

    expect(await occupancy.get('calendar-1.2026-10-12')).toEqual({
      id: 'calendar-1.2026-10-12',
      practiceId: 'practice-1',
      calendarId: 'calendar-1',
      day: '2026-10-12',
      heldMinutes: 30,
      appointmentsHeld: 1,
      completed: 0,
      noShows: 0,
      cancelledByPatient: 0,
      cancelledByPractice: 0,
    });
  });

  it('is counted again from every outcome of the day each time one changes', async () => {
    const { application, occupancy } = await arrange(bothProjections);

    await application.eventBus.publish([
      appointmentBookedV1.create({ ...first, status: 'booked' }, at('00')),
      appointmentBookedV1.create({ ...second, status: 'booked' }, at('01')),
      appointmentCancelledV1.create({ ...first, cancelledBy: 'patient' }, at('02')),
      appointmentCompletedV1.create(second, at('03')),
    ]);

    expect(await occupancy.get('calendar-1.2026-10-12')).toMatchObject({ heldMinutes: 45, appointmentsHeld: 1, completed: 1, cancelledByPatient: 1 });
  });

  it('counts the outcome a fact sets even when the outcomes were not written yet', async () => {
    const { application, occupancy } = await arrange({ OccupancyProjection });

    await application.eventBus.publish([appointmentBookedV1.create({ ...first, status: 'booked' }, at('00'))]);

    expect(await occupancy.get('calendar-1.2026-10-12')).toMatchObject({ heldMinutes: 30, appointmentsHeld: 1 });
  });

  it('frees the day an appointment leaves and holds the day it is rescheduled to', async () => {
    const { application, occupancy } = await arrange(bothProjections);
    const moved = { ...first, startsAt: '2026-10-14T09:00:00.000Z', endsAt: '2026-10-14T09:30:00.000Z', day: '2026-10-14' };

    await application.eventBus.publish([
      appointmentBookedV1.create({ ...first, status: 'booked' }, at('00')),
      appointmentRescheduledV1.create({ ...moved, previousStartsAt: first.startsAt, previousDay: first.day }, at('05')),
    ]);

    expect(await occupancy.get('calendar-1.2026-10-12')).toMatchObject({ heldMinutes: 0, appointmentsHeld: 0 });
    expect(await occupancy.get('calendar-1.2026-10-14')).toMatchObject({ heldMinutes: 30, appointmentsHeld: 1 });
  });

  it('is the same when a fact is delivered twice', async () => {
    const { application, occupancy } = await arrange(bothProjections);
    const booked = appointmentBookedV1.create({ ...first, status: 'booked' }, at('00'));

    await application.eventBus.publish([booked, booked]);

    expect(await occupancy.get('calendar-1.2026-10-12')).toMatchObject({ heldMinutes: 30, appointmentsHeld: 1 });
  });

  it('does not count an earlier fact over a later one of the same appointment', async () => {
    const { application, occupancy } = await arrange(bothProjections);

    await application.eventBus.publish([appointmentCompletedV1.create(first, at('30')), appointmentBookedV1.create({ ...first, status: 'booked' }, at('00'))]);

    expect(await occupancy.get('calendar-1.2026-10-12')).toMatchObject({ appointmentsHeld: 1, completed: 1 });
  });
});

async function arrange(projections: Readonly<Record<string, unknown>>) {
  const occupancy = new FakeOccupancyRegister();

  const application = createTestApplication({
    modules: [platformTestModule, contextModule('analytics', projections)],
    fakes: [fake(OutcomeRegister, new FakeOutcomeRegister()), fake(OccupancyRegister, occupancy)],
  });

  await application.start();

  return { application, occupancy };
}

function at(minute: string) {
  return { id: `fact-at-${minute}`, occurredAt: `2026-10-01T10:${minute}:00.000Z` };
}
