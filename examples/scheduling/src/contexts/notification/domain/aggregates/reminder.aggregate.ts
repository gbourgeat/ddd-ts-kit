import { AggregateRoot } from '@ddd-ts-kit/kernel';
import { ReminderNotDueError } from '../errors/reminder-not-due.error.js';
import { ReminderSent } from '../events/reminder-sent.event.js';

const NOTICE_MS = 24 * 60 * 60 * 1000;

export interface ReminderState {
  readonly registeredAt: Date;
  readonly appointmentId: string;
  readonly recipientId: string;
  /** The start the reminder is planned for: a reminder is sent once per appointment and start. */
  readonly startsAt: Date;
  /** 24 hours before the start. */
  readonly dueAt: Date;
  readonly status: 'planned' | 'sent' | 'withdrawn';
}

export class Reminder extends AggregateRoot<string> {
  private constructor(
    id: string,
    private state: ReminderState,
  ) {
    super(id);
  }

  static create(id: string, appointment: Pick<ReminderState, 'appointmentId' | 'recipientId' | 'startsAt'>, now: Date): Reminder {
    return new Reminder(id, { ...appointment, registeredAt: now, dueAt: dueFor(appointment.startsAt), status: 'planned' });
  }

  static rehydrate(id: string, state: ReminderState): Reminder {
    return new Reminder(id, state);
  }

  /** Plans the reminder for a start: the same start changes nothing, another one makes it due again, 24 hours before. */
  planFor(startsAt: Date): void {
    if (this.state.status !== 'withdrawn' && this.state.startsAt.getTime() === startsAt.getTime()) return;

    this.state = { ...this.state, startsAt, dueAt: dueFor(startsAt), status: 'planned' };
  }

  /** Drops the reminder while it is still planned; one already sent stays sent. */
  withdraw(): void {
    if (this.state.status !== 'planned') return;

    this.state = { ...this.state, status: 'withdrawn' };
  }

  /** Whether the reminder is to be sent at this instant: planned, 24 hours or less before a start still to come. */
  isDue(asOf: Date): boolean {
    return this.state.status === 'planned' && this.state.dueAt.getTime() <= asOf.getTime() && asOf.getTime() < this.state.startsAt.getTime();
  }

  send(asOf: Date): void {
    if (!this.isDue(asOf)) throw new ReminderNotDueError(this.id);

    this.state = { ...this.state, status: 'sent' };
    this.record(new ReminderSent(this.id, asOf, { recipientId: this.state.recipientId, appointmentId: this.state.appointmentId, startsAt: this.state.startsAt }));
  }

  get registeredAt(): Date {
    return this.state.registeredAt;
  }

  get appointmentId(): string {
    return this.state.appointmentId;
  }

  get startsAt(): Date {
    return this.state.startsAt;
  }

  get dueAt(): Date {
    return this.state.dueAt;
  }

  get status(): ReminderState['status'] {
    return this.state.status;
  }

  toState(): ReminderState {
    return { ...this.state };
  }
}

function dueFor(startsAt: Date): Date {
  return new Date(startsAt.getTime() - NOTICE_MS);
}
