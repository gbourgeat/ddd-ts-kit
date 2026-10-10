import { describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { contextModule, createTestApplication, fake } from '@ddd-ts-kit/di';
import * as analyticsDeclarations from '../../analytics.declarations.js';
import type { ReadModelStore } from '@ddd-ts-kit/kernel';
import { platformTestModule } from '../../../../platform/platform-test.module.js';
import { analyticsPermissions } from '../../application/authorization/analytics.permissions.js';
import { VerifyOccupancyCommand } from '../../application/commands/verify-occupancy/verify-occupancy.command.js';
import { OccupancyRegister } from '../../application/ports/occupancy-register.port.js';
import { OutcomeRegister } from '../../application/ports/outcome-register.port.js';
import { anOccupancy } from '../builders/occupancy.builder.js';
import { anOutcome } from '../builders/outcome.builder.js';
import { FakeOccupancyRegister } from '../fakes/occupancy-register.fake.js';
import { FakeOutcomeRegister } from '../fakes/outcome-register.fake.js';

const holders = authorizationModule({ authorizer: new RoleBasedAuthorizer({ roles: { holder: [analyticsPermissions['occupancy.verify']] } }) });
const holder = anActor().withRole('holder').build();
/** The night of Monday 2026-10-19: the days from 2026-10-12 are verified. */
const scheduledAt = new Date('2026-10-19T01:00:00.000Z');
const right = { heldMinutes: 30, appointmentsHeld: 1, completed: 1, noShows: 0, cancelledByPatient: 1, cancelledByPractice: 0 };

describe('Verify occupancy', () => {
  it('completes without answering anything', async () => {
    const { application } = arrange();

    await expect(application.commandBus.execute(new VerifyOccupancyCommand(holder, scheduledAt))).resolves.toBeUndefined();
  });

  it('is refused to an actor who does not hold the permission occupancy.verify', async () => {
    const { application } = arrange();

    await expect(application.commandBus.execute(new VerifyOccupancyCommand(anActor().build(), scheduledAt))).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('repairs the occupancy of a day that differs from its outcomes', async () => {
    const { application, outcomes, occupancy } = arrange();

    await kept(outcomes, anOutcome({ id: 'appointment-1', state: 'completed' }));
    await kept(outcomes, anOutcome({ id: 'appointment-2', state: 'cancelled-by-patient' }));
    await kept(occupancy, anOccupancy({ heldMinutes: 60, appointmentsHeld: 2 }));

    await application.commandBus.execute(new VerifyOccupancyCommand(holder, scheduledAt));

    expect(await occupancy.get('calendar-1.2026-10-12')).toEqual(anOccupancy(right));
  });

  it('counts a day whose occupancy was never written', async () => {
    const { application, outcomes, occupancy } = arrange();

    await kept(outcomes, anOutcome({ day: '2026-10-15', calendarId: 'calendar-2', state: 'no-show' }));

    await application.commandBus.execute(new VerifyOccupancyCommand(holder, scheduledAt));

    expect(await occupancy.get('calendar-2.2026-10-15')).toMatchObject({ practiceId: 'practice-1', heldMinutes: 30, appointmentsHeld: 1, noShows: 1 });
  });

  it('empties a day none of whose counted appointments is there any more', async () => {
    const { application, occupancy } = arrange();

    await kept(occupancy, anOccupancy({ heldMinutes: 30, appointmentsHeld: 1 }));

    await application.commandBus.execute(new VerifyOccupancyCommand(holder, scheduledAt));

    expect(await occupancy.get('calendar-1.2026-10-12')).toEqual(anOccupancy());
  });

  it('leaves the days before the last week as they are', async () => {
    const { application, outcomes, occupancy } = arrange();

    await kept(outcomes, anOutcome({ day: '2026-10-11' }));
    await kept(occupancy, anOccupancy({ day: '2026-10-11', heldMinutes: 90 }));

    await application.commandBus.execute(new VerifyOccupancyCommand(holder, scheduledAt));

    expect(await occupancy.get('calendar-1.2026-10-11')).toMatchObject({ heldMinutes: 90 });
  });

  it('changes nothing when the same night is verified twice', async () => {
    const { application, outcomes, occupancy } = arrange();

    await kept(outcomes, anOutcome({ id: 'appointment-1', state: 'completed' }));
    await kept(outcomes, anOutcome({ id: 'appointment-2', state: 'cancelled-by-patient' }));
    await kept(occupancy, anOccupancy({ heldMinutes: 60 }));

    await application.commandBus.execute(new VerifyOccupancyCommand(holder, scheduledAt));
    await application.commandBus.execute(new VerifyOccupancyCommand(holder, scheduledAt));

    expect(await occupancy.get('calendar-1.2026-10-12')).toEqual(anOccupancy(right));
  });

  it('counts the days from the instant the night was due, whenever it really runs', async () => {
    const { application, outcomes, occupancy } = arrange();

    await kept(outcomes, anOutcome({ day: '2026-10-12' }));
    application.clock.advance(400 * 24 * 60 * 60 * 1000);

    await application.commandBus.execute(new VerifyOccupancyCommand(holder, scheduledAt));

    expect(await occupancy.get('calendar-1.2026-10-12')).toMatchObject({ heldMinutes: 30 });
  });
});

/** Writes a line as an earlier fact would have. */
async function kept<Row extends { readonly id: string }>(register: ReadModelStore<Row>, line: Row): Promise<void> {
  await register.upsertIfNewer(line.id, { eventId: `fact-of-${line.id}`, occurredAt: new Date('2026-10-13T10:00:00.000Z') }, () => line);
}

function arrange() {
  const outcomes = new FakeOutcomeRegister();
  const occupancy = new FakeOccupancyRegister();

  const application = createTestApplication({
    modules: [platformTestModule, contextModule('analytics', analyticsDeclarations), holders],
    fakes: [fake(OutcomeRegister, outcomes), fake(OccupancyRegister, occupancy)],
  });

  return { application, outcomes, occupancy };
}
