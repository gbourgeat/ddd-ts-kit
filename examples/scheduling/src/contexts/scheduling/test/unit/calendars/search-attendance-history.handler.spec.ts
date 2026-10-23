import { describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { Criteria } from '@ddd-ts-kit/kernel';
import { schedulingPermissions } from '@/contexts/scheduling/scheduling.permissions';
import type { AttendanceEntry } from '@/contexts/scheduling/calendars/application/ports/attendance-history.port';
import { SearchAttendanceHistoryQuery } from '@/contexts/scheduling/calendars/application/queries/search-attendance-history/search-attendance-history.query';
import { aSchedulingWorld } from '@/contexts/scheduling/test/worlds/scheduling.world';

const holders = authorizationModule({
  authorizer: new RoleBasedAuthorizer({
    roles: { holder: [schedulingPermissions['attendance.read']] },
  }),
});

const holder = anActor().withRole('holder').build();
const at = new Date('2026-03-02T10:00:00.000Z');

describe('Search attendance history', () => {
  it('answers the history of the patient in the practice, in the order of its stream, and nothing of another record', async () => {
    const { application } = await arrange([
      entry('practice-1.patient-1', 2, 'no-show'),
      entry('practice-1.patient-1', 1, 'opened'),
      entry('practice-1.patient-2', 1, 'opened'),
    ]);

    const page = await application.queryBus.execute(
      new SearchAttendanceHistoryQuery(holder, 'practice-1', 'patient-1', Criteria.of<AttendanceEntry>()),
    );

    expect(page.items.map(({ id }) => id)).toEqual(['practice-1.patient-1#1', 'practice-1.patient-1#2']);
  });

  it('applies the criteria of the asker within that history', async () => {
    const { application } = await arrange([
      entry('practice-1.patient-1', 1, 'opened'),
      entry('practice-1.patient-1', 2, 'no-show'),
    ]);

    const page = await application.queryBus.execute(
      new SearchAttendanceHistoryQuery(
        holder,
        'practice-1',
        'patient-1',
        Criteria.of<AttendanceEntry>().where('fact', 'eq', 'no-show'),
      ),
    );

    expect(page.items.map(({ fact }) => fact)).toEqual(['no-show']);
  });

  it('is refused to an actor who does not hold the permission attendance.read', async () => {
    const { application } = await arrange([]);
    const query = new SearchAttendanceHistoryQuery(anActor().build(), 'practice-1', 'patient-1', Criteria.of());

    await expect(application.queryBus.execute(query)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

async function arrange(entries: readonly AttendanceEntry[]) {
  const { application } = await aSchedulingWorld({
    modules: [holders],
    given: async (fakes) => {
      for (const written of entries) {
        await fakes.attendanceHistory.upsertIfNewer(
          written.id,
          { eventId: written.id, occurredAt: at, version: written.version },
          () => written,
        );
      }
    },
  });

  return { application };
}

function entry(recordId: string, version: number, fact: AttendanceEntry['fact']): AttendanceEntry {
  return {
    id: `${recordId}#${version}`,
    recordId,
    version,
    fact,
    appointmentId: fact === 'opened' ? null : `appointment-${version}`,
    startsAt: fact === 'opened' ? null : at,
    reason: null,
    notedAt: at,
  };
}
