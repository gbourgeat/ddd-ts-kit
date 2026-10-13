import { AggregateRoot, DomainError } from '@ddd-ts-kit/kernel';
import { WaitlistError } from '@/contexts/scheduling/domain/errors/waitlist.error';
import { CalendarError } from '@/contexts/scheduling/domain/errors/calendar.error';
import { WaitlistJoined } from '@/contexts/scheduling/domain/events/waitlist-joined.event';
import { WaitlistSlotOffered } from '@/contexts/scheduling/domain/events/waitlist-slot-offered.event';
import { Offer } from '@/contexts/scheduling/domain/value-objects/offer.vo';
import type { Slot } from '@/contexts/scheduling/domain/value-objects/slot.vo';
import { TimeZone } from '@/contexts/scheduling/domain/value-objects/time-zone.vo';
import type { Waiter } from '@/contexts/scheduling/domain/value-objects/waiter.vo';
import type { Calendar } from '@/contexts/scheduling/domain/aggregates/calendar.aggregate';

export interface WaitlistState {
  readonly registeredAt: Date;
  readonly calendarId: string;
  /** The day waited for, `YYYY-MM-DD` in the time zone of the practice. */
  readonly day: string;
  /** In arrival order. */
  readonly waiters: readonly Waiter[];
}

/** A slot that is free again on a calendar, with the slots still held around it. */
export interface FreedSlot {
  readonly slot: Slot;
  readonly calendar: Calendar;
  readonly held: readonly Slot[];
}

const MINUTE = 60_000;
/** How long an offer waits for its waiter, in minutes. */
const HOLD = 30;

export class Waitlist extends AggregateRoot<string> {
  private constructor(
    id: string,
    private state: WaitlistState,
  ) {
    super(id);
  }

  /** The identifier of the one waitlist of a calendar and a day. */
  static idOf(calendarId: string, day: string): string {
    return `${calendarId}.${day}`;
  }

  /** A waitlist is born empty; it announces nothing until someone joins. */
  static create(wait: { readonly calendarId: string; readonly day: string }, now: Date): Waitlist {
    if (!TimeZone.isDay(wait.day)) {
      throw CalendarError.invalidDay(wait.day);
    }

    return new Waitlist(Waitlist.idOf(wait.calendarId, wait.day), {
      registeredAt: now,
      calendarId: wait.calendarId,
      day: wait.day,
      waiters: [],
    });
  }

  static rehydrate(id: string, state: WaitlistState): Waitlist {
    return new Waitlist(id, state);
  }

  /** A patient waits once on a waitlist, whatever the appointment type. */
  join(waiter: Waiter, now: Date): void {
    if (this.state.waiters.some((known) => known.patientId === waiter.patientId)) {
      throw WaitlistError.alreadyWaiting(waiter.patientId);
    }

    this.state = { ...this.state, waiters: [...this.state.waiters, waiter] };
    this.record(new WaitlistJoined(this.id, now, waiter.patientId, waiter.appointmentTypeId));
  }

  /**
   * Gives a freed slot to the first waiter, in arrival order, whose appointment type fits it:
   * the calendar can take the type at the start of the slot, what the type holds ends within
   * the freed slot and crosses nothing still held. The waiter leaves the waitlist with the
   * offer, held thirty minutes or until the slot starts. Nothing is offered when nobody fits.
   */
  offer(freed: FreedSlot, now: Date): Offer | undefined {
    const offered = this.state.waiters
      .map((waiter) => offerOf(waiter, freed, now))
      .find((candidate) => candidate !== undefined);

    if (offered === undefined) {
      return undefined;
    }

    this.state = { ...this.state, waiters: this.state.waiters.filter((waiter) => !waiter.equals(offered.waiter)) };
    this.record(new WaitlistSlotOffered(this.id, now, offered));

    return offered;
  }

  get registeredAt(): Date {
    return this.state.registeredAt;
  }

  get calendarId(): string {
    return this.state.calendarId;
  }

  get day(): string {
    return this.state.day;
  }

  get waiters(): readonly Waiter[] {
    return this.state.waiters;
  }

  toState(): WaitlistState {
    return { ...this.state };
  }
}

function offerOf(waiter: Waiter, freed: FreedSlot, now: Date): Offer | undefined {
  const slot = slotOf(waiter, freed, now);

  if (
    slot === undefined ||
    slot.heldUntil.getTime() > freed.slot.heldUntil.getTime() ||
    freed.held.some((held) => held.overlaps(slot))
  ) {
    return undefined;
  }

  const expiresAt = new Date(Math.min(now.getTime() + HOLD * MINUTE, slot.startsAt.getTime()));

  return Offer.create({ waiter, slot, expiresAt });
}

/** What the calendar would hold for the waiter from the start of the freed slot, when it can take it. */
function slotOf(waiter: Waiter, freed: FreedSlot, now: Date): Slot | undefined {
  try {
    return freed.calendar.slotFor(waiter.appointmentTypeId, freed.slot.startsAt, now);
  } catch (refusal) {
    if (refusal instanceof DomainError) {
      return undefined;
    }

    throw refusal;
  }
}
