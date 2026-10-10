import { unwrap } from '@ddd-ts-kit/kernel';
import { Builder, sequence, type Defaults } from '@ddd-ts-kit/testing';
import { Waitlist } from '#src/contexts/scheduling/domain/aggregates/waitlist.aggregate.js';
import { Waiter } from '#src/contexts/scheduling/domain/value-objects/waiter.vo.js';

interface WaitlistIngredients {
  readonly bornAt: Date;
  readonly calendarId: string;
  readonly day: string;
  readonly waiters: readonly (readonly [patientId: string, appointmentTypeId: string])[];
}

const MINUTE = 60_000;

/** The waitlist of a calendar for Monday 2 March 2026, empty unless a test says who waits. */
export class WaitlistBuilder extends Builder<WaitlistIngredients, Waitlist> {
  bornAt(instant: Date): this {
    return this.with('bornAt', instant);
  }

  forCalendar(calendarId: string): this {
    return this.with('calendarId', calendarId);
  }

  onDay(day: string): this {
    return this.with('day', day);
  }

  /** A patient who joined, a minute after the previous one, for an appointment type. */
  joinedBy(patientId: string, appointmentTypeId = 'consultation'): this {
    return this.adding('waiters', [patientId, appointmentTypeId]);
  }

  protected defaults(): Defaults<WaitlistIngredients> {
    return {
      bornAt: new Date('2026-01-01T00:00:00.000Z'),
      calendarId: sequence('calendar'),
      day: '2026-03-02',
      waiters: [],
    };
  }

  protected construct({ bornAt, calendarId, day, waiters }: WaitlistIngredients): Waitlist {
    const built = Waitlist.create({ calendarId, day }, bornAt);

    waiters.forEach(([patientId, appointmentTypeId], index) => {
      const joinedAt = new Date(bornAt.getTime() + (index + 1) * MINUTE);

      built.join(unwrap(Waiter.create({ patientId, appointmentTypeId, joinedAt })), joinedAt);
    });

    built.pullEvents();

    return built;
  }
}

export function aWaitlist(): WaitlistBuilder {
  return new WaitlistBuilder();
}
