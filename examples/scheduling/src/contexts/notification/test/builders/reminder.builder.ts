import { Builder, sequence, type Defaults } from '@ddd-ts-kit/testing';
import { Reminder } from '../../domain/aggregates/reminder.aggregate.js';

interface ReminderIngredients {
  readonly id: string;
  readonly bornAt: Date;
  readonly appointmentId: string;
  readonly recipientId: string;
  readonly startsAt: Date;
  readonly sentAt: Date | undefined;
  readonly withdrawn: boolean;
}

export class ReminderBuilder extends Builder<ReminderIngredients, Reminder> {
  identifiedBy(id: string): this {
    return this.with('id', id);
  }

  bornAt(instant: Date): this {
    return this.with('bornAt', instant);
  }

  of(appointmentId: string): this {
    return this.with('appointmentId', appointmentId);
  }

  remindingOf(recipientId: string): this {
    return this.with('recipientId', recipientId);
  }

  plannedFor(startsAt: Date): this {
    return this.with('startsAt', startsAt);
  }

  /** Sent at an instant inside its last 24 hours before the start. */
  sent(at: Date): this {
    return this.with('sentAt', at);
  }

  withdrawn(): this {
    return this.with('withdrawn', true);
  }

  protected defaults(): Defaults<ReminderIngredients> {
    return {
      id: sequence('reminder'),
      bornAt: new Date('2026-01-01T00:00:00.000Z'),
      appointmentId: sequence('appointment'),
      recipientId: 'patient-1',
      startsAt: new Date('2026-01-10T09:00:00.000Z'),
      sentAt: undefined,
      withdrawn: false,
    };
  }

  protected construct(ingredients: ReminderIngredients): Reminder {
    const { id, bornAt, sentAt, withdrawn, ...appointment } = ingredients;
    const built = Reminder.create(id, appointment, bornAt);

    if (sentAt !== undefined) {
      built.send(sentAt);
      built.pullEvents();
    }

    if (withdrawn) {
      built.withdraw();
    }

    return built;
  }
}

export function aReminder(): ReminderBuilder {
  return new ReminderBuilder();
}
