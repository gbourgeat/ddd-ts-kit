import { AggregateRoot, type StoredFile } from '@ddd-ts-kit/kernel';
import { AppointmentError } from '@/contexts/scheduling/domain/errors/appointment.error';
import { AppointmentAnnotated } from '@/contexts/scheduling/domain/events/appointment-annotated.event';
import { AppointmentBooked } from '@/contexts/scheduling/domain/events/appointment-booked.event';
import { AppointmentCancelled } from '@/contexts/scheduling/domain/events/appointment-cancelled.event';
import { AppointmentCompleted } from '@/contexts/scheduling/domain/events/appointment-completed.event';
import { AppointmentConfirmed } from '@/contexts/scheduling/domain/events/appointment-confirmed.event';
import { AppointmentExpired } from '@/contexts/scheduling/domain/events/appointment-expired.event';
import { AppointmentMarkedNoShow } from '@/contexts/scheduling/domain/events/appointment-marked-no-show.event';
import { AppointmentRescheduled } from '@/contexts/scheduling/domain/events/appointment-rescheduled.event';
import type { AttachedDocument } from '@/contexts/scheduling/domain/value-objects/attached-document.vo';
import type { Booking } from '@/contexts/scheduling/domain/value-objects/booking.vo';
import type { Cancellation } from '@/contexts/scheduling/domain/value-objects/cancellation.vo';
import type { Slot } from '@/contexts/scheduling/domain/value-objects/slot.vo';
import { AppointmentStatus } from '@/contexts/scheduling/domain/vocabularies/appointment-status.vocabulary';

export interface AppointmentState {
  readonly registeredAt: Date;
  /** The instant of the last fact this state reflects. */
  readonly changedAt: Date;
  readonly booking: Booking;
  /** `requested` and `booked` hold their slot; the four others are ends and hold nothing. */
  readonly status: AppointmentStatus;
  /** Only while requested: the instant after which the appointment expires unless confirmed. */
  readonly confirmBefore?: Date;
  readonly cancellation?: Cancellation;
  /** What the staff of the practice keeps about the appointment; its patient never sees it. */
  readonly internalNote?: string;
  /** The document the practice attached, whatever the status: its reference, never its content. */
  readonly document?: AttachedDocument;
}

export class Appointment extends AggregateRoot<string> {
  private constructor(
    id: string,
    private state: AppointmentState,
  ) {
    super(id);
  }

  /** Books: the slot is held and nothing is left to confirm. */
  static create(id: string, booking: Booking, now: Date): Appointment {
    const created = new Appointment(id, {
      registeredAt: now,
      changedAt: now,
      booking,
      status: AppointmentStatus.Booked,
    });

    created.record(new AppointmentBooked(id, now, { booking }));

    return created;
  }

  /** Requests: the slot is held until `confirmBefore`, and freed then unless the appointment was confirmed. */
  static request(
    id: string,
    booking: Booking,
    terms: { readonly now: Date; readonly confirmBefore: Date },
  ): Appointment {
    const { now, confirmBefore } = terms;

    const created = new Appointment(id, {
      registeredAt: now,
      changedAt: now,
      booking,
      status: AppointmentStatus.Requested,
      confirmBefore,
    });

    created.record(new AppointmentBooked(id, now, { booking, confirmBefore }));

    return created;
  }

  static rehydrate(id: string, state: AppointmentState): Appointment {
    return new Appointment(id, state);
  }

  confirm(now: Date): void {
    this.refuseWhenEnded();

    if (this.state.status === AppointmentStatus.Booked) {
      throw AppointmentError.alreadyConfirmed(this.id);
    }

    this.state = {
      ...this.carried(),
      changedAt: now,
      status: AppointmentStatus.Booked,
    };

    this.record(new AppointmentConfirmed(this.id, now, this.state.booking));
  }

  cancel(cancellation: Cancellation, now: Date): void {
    this.refuseWhenEnded();

    this.state = {
      ...this.carried(),
      changedAt: now,
      status: AppointmentStatus.Cancelled,
      cancellation,
    };

    this.record(new AppointmentCancelled(this.id, now, { booking: this.state.booking, cancellation }));
  }

  /** Moves to another slot of the same calendar in one step: the previous slot is free as soon as this one is held. */
  reschedule(slot: Slot, day: string, now: Date): void {
    this.refuseWhenEnded();

    const previous = this.state.booking;
    const booking = previous.movedTo(slot, day);

    this.state = { ...this.state, changedAt: now, booking };
    this.record(new AppointmentRescheduled(this.id, now, { booking, previous }));
  }

  complete(now: Date): void {
    this.refuseWhenEnded();
    this.refuseBeforeStart(now);

    this.state = {
      ...this.carried(),
      changedAt: now,
      status: AppointmentStatus.Completed,
    };

    this.record(new AppointmentCompleted(this.id, now, this.state.booking));
  }

  markNoShow(now: Date): void {
    this.refuseWhenEnded();
    this.refuseBeforeStart(now);

    this.state = {
      ...this.carried(),
      changedAt: now,
      status: AppointmentStatus.NoShow,
    };

    this.record(new AppointmentMarkedNoShow(this.id, now, this.state.booking));
  }

  /** Safe to repeat: an appointment that is confirmed, ended, or whose deadline is later than `at` stays as it is. */
  expire(at: Date): void {
    const deadline = this.state.confirmBefore;

    if (
      this.state.status !== AppointmentStatus.Requested ||
      deadline === undefined ||
      deadline.getTime() > at.getTime()
    ) {
      return;
    }

    this.state = {
      ...this.carried(),
      changedAt: at,
      status: AppointmentStatus.Expired,
    };

    this.record(new AppointmentExpired(this.id, at, this.state.booking));
  }

  /** Attaches a document in place of the one it held, whatever the status: answers the file no longer referenced, to delete once committed. */
  attachDocument(document: AttachedDocument, now: Date): StoredFile | undefined {
    const replaced = this.state.document?.file;

    this.state = { ...this.state, changedAt: now, document };

    return replaced;
  }

  /** Takes the document off: answers its file, to delete once committed. */
  removeDocument(now: Date): StoredFile {
    const { document, ...kept } = this.state;

    if (document === undefined) {
      throw AppointmentError.noDocument(this.id);
    }

    this.state = { ...kept, changedAt: now };

    return document.file;
  }

  /** Whether this appointment still holds an instant of that slot, its buffer included. */
  holds(slot: Slot): boolean {
    return this.isActive && this.state.booking.slot.overlaps(slot);
  }

  /** Whether this appointment is still to come for its patient at that instant. */
  isHeldAfter(instant: Date): boolean {
    return this.isActive && this.state.booking.slot.startsAfter(instant);
  }

  get isActive(): boolean {
    return this.state.status === AppointmentStatus.Requested || this.state.status === AppointmentStatus.Booked;
  }

  get booking(): Booking {
    return this.state.booking;
  }

  get patientId(): string {
    return this.state.booking.patientId;
  }

  get calendarId(): string {
    return this.state.booking.calendarId;
  }

  get slot(): Slot {
    return this.state.booking.slot;
  }

  /** The staff writes what it keeps about the appointment, until its end. */
  annotate(internalNote: string, now: Date): void {
    this.refuseWhenEnded();

    this.state = { ...this.state, changedAt: now, internalNote };

    const { booking, confirmBefore } = this.state;

    this.record(
      new AppointmentAnnotated(this.id, now, {
        internalNote,
        booking,
        ...(confirmBefore === undefined ? {} : { confirmBefore }),
      }),
    );
  }

  get status(): AppointmentState['status'] {
    return this.state.status;
  }

  get confirmBefore(): Date | undefined {
    return this.state.confirmBefore;
  }

  get cancellation(): Cancellation | undefined {
    return this.state.cancellation;
  }

  get registeredAt(): Date {
    return this.state.registeredAt;
  }

  get changedAt(): Date {
    return this.state.changedAt;
  }

  get internalNote(): string | undefined {
    return this.state.internalNote;
  }

  get document(): AttachedDocument | undefined {
    return this.state.document;
  }

  toState(): AppointmentState {
    return { ...this.state };
  }

  /** What a change of status keeps: when the appointment was registered, its booking, its document. */
  /** What every change of standing keeps: the note is the staff's and the document the practice's, not the slot's. */
  private carried(): Pick<AppointmentState, 'registeredAt' | 'booking' | 'document' | 'internalNote'> {
    const { registeredAt, booking, document, internalNote } = this.state;

    return {
      registeredAt,
      booking,
      ...(document === undefined ? {} : { document }),
      ...(internalNote === undefined ? {} : { internalNote }),
    };
  }

  private refuseWhenEnded(): void {
    if (!this.isActive) {
      throw AppointmentError.ended(this.id, this.state.status);
    }
  }

  private refuseBeforeStart(now: Date): void {
    if (this.state.booking.slot.startsAfter(now)) {
      throw AppointmentError.notStarted(this.id, this.state.booking.slot.startsAt);
    }
  }
}
