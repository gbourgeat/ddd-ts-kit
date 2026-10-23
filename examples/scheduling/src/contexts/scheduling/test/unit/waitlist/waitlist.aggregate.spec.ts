import { describe, expect, it } from 'vitest';
import { given } from '@ddd-ts-kit/testing';
import { Waitlist } from '@/contexts/scheduling/waitlist/domain/aggregates/waitlist.aggregate';
import { Slot } from '@/contexts/scheduling/calendars/domain/value-objects/slot.vo';
import { Waiter } from '@/contexts/scheduling/waitlist/domain/value-objects/waiter.vo';
import { aCalendar } from '@/contexts/scheduling/test/builders/calendar.builder';
import { aWaitlist } from '@/contexts/scheduling/test/builders/waitlist.builder';

/** Friday before the Monday the waitlists of this spec wait for. */
const now = new Date('2026-02-27T10:00:00.000Z');

/** Open all day, offering a consultation of thirty minutes and a surgery of an hour followed by a buffer of fifteen minutes. */
const calendar = aCalendar()
  .identifiedBy('calendar-1')
  .openEveryDay(['08:00', '20:00'])
  .offering('consultation')
  .offering('surgery', { duration: 60, buffer: 15 })
  .build();

describe('Waitlist', () => {
  it('is born with the identity of its calendar and its day', () => {
    const bornAt = new Date('2026-03-01T00:00:00.000Z');

    const born = aWaitlist().forCalendar('calendar-7').onDay('2026-03-02').bornAt(bornAt).build();

    expect(born.id).toBe('calendar-7.2026-03-02');
    expect(born).toMatchObject({ calendarId: 'calendar-7', day: '2026-03-02', registeredAt: bornAt, waiters: [] });
  });

  it('is rehydrated in its stored state without recording a new fact', () => {
    const stored = aWaitlist().joinedBy('patient-1').build();

    const loaded = Waitlist.rehydrate(stored.id, stored.toState());

    expect(loaded.toState()).toEqual(stored.toState());
    expect(loaded.pullEvents()).toEqual([]);
  });

  it('is born empty and announces nothing until someone joins', () => {
    const born = Waitlist.create({ calendarId: 'calendar-1', day: '2026-03-02' }, now);

    expect(born.waiters).toEqual([]);
    expect(born.pullEvents()).toEqual([]);
  });

  it.each(['2026-02-30', 'Monday', ''])('refuses to be born for %j, which is not a day', (day) => {
    expect(() => Waitlist.create({ calendarId: 'calendar-1', day }, now)).toThrow(
      expect.objectContaining({ code: 'INVALID_DAY' }),
    );
  });

  it('takes the patients who join in arrival order', () => {
    given(aWaitlist().joinedBy('patient-1'))
      .when((waitlist) => waitlist.join(waiter('patient-2', 'surgery'), now))
      .thenEvents([{ name: 'scheduling.waitlist.joined', patientId: 'patient-2', appointmentTypeId: 'surgery' }])
      .thenState((waitlist) =>
        expect(waitlist.waiters.map((known) => known.patientId)).toEqual(['patient-1', 'patient-2']),
      );
  });

  it('refuses a patient who already waits, whatever the appointment type', () => {
    given(aWaitlist().joinedBy('patient-1'))
      .when((waitlist) => waitlist.join(waiter('patient-1', 'surgery'), now))
      .thenError('ALREADY_WAITING')
      .thenState((waitlist) => expect(waitlist.waiters).toHaveLength(1));
  });
});

describe('Waitlist, offering a freed slot', () => {
  it('offers the slot to the first waiter, held thirty minutes, and takes them off the waitlist', () => {
    const waitlist = aWaitlist().joinedBy('patient-1').joinedBy('patient-2').build();

    const offer = waitlist.offer({ slot: freed('09:00', '09:30'), calendar, held: [] }, now);

    expect(offer?.waiter.patientId).toBe('patient-1');
    expect(offer?.slot.equals(freed('09:00', '09:30'))).toBe(true);
    expect(offer?.expiresAt).toEqual(new Date('2026-02-27T10:30:00.000Z'));
    expect(waitlist.waiters.map((known) => known.patientId)).toEqual(['patient-2']);
  });

  it('announces the offer', () => {
    given(aWaitlist().joinedBy('patient-1'))
      .when((waitlist) => waitlist.offer({ slot: freed('09:00', '09:30'), calendar, held: [] }, now))
      .thenEvents([{ name: 'scheduling.waitlist.slot-offered' }]);
  });

  it('passes over a waiter whose appointment type does not fit the slot', () => {
    const waitlist = aWaitlist().joinedBy('patient-1', 'surgery').joinedBy('patient-2', 'consultation').build();

    const offer = waitlist.offer({ slot: freed('09:00', '09:30'), calendar, held: [] }, now);

    expect(offer?.waiter.patientId).toBe('patient-2');
    expect(waitlist.waiters.map((known) => known.patientId)).toEqual(['patient-1']);
  });

  it('counts the buffer of the type in what must fit', () => {
    const waitlist = aWaitlist().joinedBy('patient-1', 'surgery').build();

    expect(waitlist.offer({ slot: freed('09:00', '10:00'), calendar, held: [] }, now)).toBeUndefined();

    expect(waitlist.offer({ slot: freed('09:00', '10:00', '10:15'), calendar, held: [] }, now)?.waiter.patientId).toBe(
      'patient-1',
    );
  });

  it('offers a shorter appointment in a longer freed slot', () => {
    const waitlist = aWaitlist().joinedBy('patient-1', 'consultation').build();

    const offer = waitlist.offer({ slot: freed('09:00', '10:00'), calendar, held: [] }, now);

    expect(offer?.slot.equals(freed('09:00', '09:30'))).toBe(true);
  });

  it('offers nothing over a slot that is still held', () => {
    given(aWaitlist().joinedBy('patient-1'))
      .when((waitlist) =>
        waitlist.offer({ slot: freed('09:00', '09:30'), calendar, held: [freed('09:15', '09:45')] }, now),
      )
      .thenEvents([])
      .thenState((waitlist) => expect(waitlist.waiters).toHaveLength(1));
  });

  it('offers nothing when the calendar can no longer take the slot: too late, or outside its availability', () => {
    const waitlist = aWaitlist().joinedBy('patient-1').build();

    expect(
      waitlist.offer({ slot: freed('09:00', '09:30'), calendar, held: [] }, new Date('2026-03-02T07:30:00.000Z')),
    ).toBeUndefined();

    expect(waitlist.offer({ slot: freed('22:00', '22:30'), calendar, held: [] }, now)).toBeUndefined();
    expect(waitlist.waiters).toHaveLength(1);
  });

  it('offers nothing when nobody waits', () => {
    given(aWaitlist())
      .when((waitlist) => waitlist.offer({ slot: freed('09:00', '09:30'), calendar, held: [] }, now))
      .thenEvents([]);
  });

  it('never holds an offer past the start of its slot', () => {
    const waitlist = aWaitlist().joinedBy('patient-1').build();

    const offer = waitlist.offer(
      { slot: freed('09:00', '09:30'), calendar, held: [] },
      new Date('2026-03-02T05:45:00.000Z'),
    );

    expect(offer?.expiresAt).toEqual(new Date('2026-03-02T06:15:00.000Z'));
  });
});

/** A slot of Monday 2 March 2026, in the wall-clock time of Paris (UTC+1 that day). */
function freed(start: string, end: string, heldUntil = end): Slot {
  return Slot.between(paris(start), paris(end), paris(heldUntil));
}

function paris(time: string): Date {
  return new Date(`2026-03-02T${time}:00.000+01:00`);
}

function waiter(patientId: string, appointmentTypeId: string): Waiter {
  return Waiter.create({ patientId, appointmentTypeId, joinedAt: now });
}
