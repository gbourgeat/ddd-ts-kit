import { describe, expect, it } from 'vitest';
import { contextModule, createTestApplication, fake } from '@ddd-ts-kit/di';
import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import { platformTestModule } from '../../../../platform/platform-test.module.js';
import {
  appointmentBookedV1,
  appointmentCancelledV1,
  appointmentCompletedV1,
  appointmentConfirmedV1,
  appointmentExpiredV1,
  appointmentMarkedNoShowV1,
  appointmentRescheduledV1,
} from '../../../scheduling/published-language/index.js';
import { OutcomeRegister } from '../../application/ports/outcome-register.port.js';
import { OutcomesProjection } from '../../application/projections/outcomes.projection.js';
import { anAppointmentFact } from '../builders/appointment-fact.builder.js';
import { FakeOutcomeRegister } from '../fakes/outcome-register.fake.js';

const fact = anAppointmentFact();
const booked = appointmentBookedV1.create({ ...fact, status: 'booked' }, at('00'));
const completed = appointmentCompletedV1.create(fact, at('30'));

const FACTS: readonly (readonly [string, IntegrationEvent, string])[] = [
  ['booked', booked, 'held'],
  [
    'requested, still to confirm',
    appointmentBookedV1.create({ ...fact, status: 'requested', confirmBefore: '2026-10-02T10:00:00.000Z' }, at('00')),
    'held',
  ],
  ['confirmed', appointmentConfirmedV1.create(fact, at('05')), 'held'],
  [
    'cancelled by the patient',
    appointmentCancelledV1.create({ ...fact, cancelledBy: 'patient' }, at('10')),
    'cancelled-by-patient',
  ],
  [
    'cancelled by the practice',
    appointmentCancelledV1.create({ ...fact, cancelledBy: 'practice' }, at('10')),
    'cancelled-by-practice',
  ],
  ['expired', appointmentExpiredV1.create(fact, at('15')), 'expired'],
  ['completed', completed, 'completed'],
  ['marked as a no-show', appointmentMarkedNoShowV1.create(fact, at('30')), 'no-show'],
];

describe('The outcomes of appointments', () => {
  it.each(FACTS)('stand as the fact says once an appointment is %s', async (_name, event, state) => {
    const { application, outcomes } = await arrange();

    await application.eventBus.publish([event]);

    expect(await outcomes.get('appointment-1')).toMatchObject({
      calendarId: 'calendar-1',
      practiceId: 'practice-1',
      day: '2026-10-12',
      state,
    });
  });

  it('keep the time the appointment holds and the instant it last changed', async () => {
    const { application, outcomes } = await arrange();

    await application.eventBus.publish([booked]);

    expect(await outcomes.get('appointment-1')).toMatchObject({
      startsAt: new Date('2026-10-12T08:00:00.000Z'),
      endsAt: new Date('2026-10-12T08:30:00.000Z'),
      changedAt: new Date('2026-10-01T10:00:00.000Z'),
    });
  });

  it('follow a rescheduled appointment to its new day and time', async () => {
    const { application, outcomes } = await arrange();

    const moved = anAppointmentFact({
      startsAt: '2026-10-14T09:00:00.000Z',
      endsAt: '2026-10-14T09:30:00.000Z',
      day: '2026-10-14',
    });

    const rescheduled = appointmentRescheduledV1.create(
      { ...moved, previousStartsAt: fact.startsAt, previousDay: fact.day },
      at('20'),
    );

    await application.eventBus.publish([booked, rescheduled]);

    expect(await outcomes.get('appointment-1')).toMatchObject({
      day: '2026-10-14',
      startsAt: new Date('2026-10-14T09:00:00.000Z'),
      state: 'held',
    });
  });

  it('end on the same line when a fact is delivered twice', async () => {
    const { application, outcomes } = await arrange();

    await application.eventBus.publish([booked, completed, completed]);

    expect(await outcomes.get('appointment-1')).toMatchObject({
      state: 'completed',
      changedAt: new Date('2026-10-01T10:30:00.000Z'),
    });
  });

  it('end on the latest fact when an earlier one is delivered after it', async () => {
    const { application, outcomes } = await arrange();

    await application.eventBus.publish([completed, booked]);

    expect(await outcomes.get('appointment-1')).toMatchObject({ state: 'completed' });
  });
});

async function arrange() {
  const outcomes = new FakeOutcomeRegister();

  const application = createTestApplication({
    modules: [platformTestModule, contextModule('analytics', { OutcomesProjection })],
    fakes: [fake(OutcomeRegister, outcomes)],
  });

  await application.start();

  return { application, outcomes };
}

function at(minute: string) {
  return { id: `fact-at-${minute}`, occurredAt: `2026-10-01T10:${minute}:00.000Z` };
}
