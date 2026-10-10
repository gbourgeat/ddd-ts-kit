import { unwrap } from '@ddd-ts-kit/kernel';
import { Waitlist } from '../../domain/aggregates/waitlist.aggregate.js';
import { Waiter } from '../../domain/value-objects/waiter.vo.js';
import type { WaitlistColumns, WaitlistRow } from './waitlist-row.schema.js';

type StoredWaiter = { readonly patientId: string; readonly appointmentTypeId: string; readonly joinedAt: string };

export const WaitlistMapper = {
  toDomain(row: WaitlistRow): Waitlist {
    const waiters = (JSON.parse(row.waiters) as StoredWaiter[]).map((stored) =>
      unwrap(Waiter.create({ ...stored, joinedAt: new Date(stored.joinedAt) })),
    );

    const loaded = Waitlist.rehydrate(row.id, {
      registeredAt: row.registered_at,
      calendarId: row.calendar_id,
      day: row.day,
      waiters,
    });

    loaded.version = row.version;

    return loaded;
  },

  toRow(saved: Waitlist): WaitlistColumns {
    const state = saved.toState();

    const waiters = state.waiters.map(
      ({ patientId, appointmentTypeId, joinedAt }): StoredWaiter => ({
        patientId,
        appointmentTypeId,
        joinedAt: joinedAt.toISOString(),
      }),
    );

    return {
      id: saved.id,
      registered_at: state.registeredAt,
      calendar_id: state.calendarId,
      day: state.day,
      waiters: JSON.stringify(waiters),
    };
  },
};
