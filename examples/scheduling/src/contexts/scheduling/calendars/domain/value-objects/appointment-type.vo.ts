import { ValueObject } from '@ddd-ts-kit/kernel';
import { InvalidAppointmentType } from '@/contexts/scheduling/calendars/domain/errors/invalid-appointment-type.error';
import { Slot } from '@/contexts/scheduling/calendars/domain/value-objects/slot.vo';

export type AppointmentTypeProps = {
  readonly id: string;
  readonly name: string;
  /** How long an appointment lasts, in minutes. */
  readonly duration: number;
  /** The step, in minutes from midnight, on which appointments start. */
  readonly grid: number;
  /** The minutes kept free after an appointment. */
  readonly buffer: number;
  readonly needsConfirmation: boolean;
};

const MINUTE = 60_000;
const DAY = 24 * 60;

/** A kind of appointment a calendar offers. */
export class AppointmentType extends ValueObject<AppointmentTypeProps> {
  private constructor(props: AppointmentTypeProps) {
    super(props);
  }

  static create(facts: AppointmentTypeProps): AppointmentType {
    const refusal = refusalOf(facts);

    if (refusal === undefined) {
      return new AppointmentType({ ...facts, name: facts.name.trim() });
    }

    throw InvalidAppointmentType.forRule(refusal);
  }

  /** What an appointment of this type holds when it starts at the instant: its duration, then its buffer. */
  slotAt(startsAt: Date): Slot {
    const endsAt = new Date(startsAt.getTime() + this.props.duration * MINUTE);

    return Slot.between(startsAt, endsAt, new Date(endsAt.getTime() + this.props.buffer * MINUTE));
  }

  /** Whether a wall-clock minute from midnight is a start of the grid. */
  startsOn(minute: number): boolean {
    return minute % this.props.grid === 0;
  }

  get id(): string {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get duration(): number {
    return this.props.duration;
  }

  get grid(): number {
    return this.props.grid;
  }

  get buffer(): number {
    return this.props.buffer;
  }

  get needsConfirmation(): boolean {
    return this.props.needsConfirmation;
  }
}

function refusalOf(facts: AppointmentTypeProps): string | undefined {
  if (facts.id.trim().length === 0 || facts.name.trim().length === 0) {
    return 'has an identifier and a name';
  }

  if (!Number.isInteger(facts.duration) || facts.duration <= 0) {
    return 'lasts a positive number of minutes';
  }

  if (!Number.isInteger(facts.grid) || facts.grid <= 0 || DAY % facts.grid !== 0) {
    return 'has a grid of positive minutes that divides a day';
  }

  if (!Number.isInteger(facts.buffer) || facts.buffer < 0) {
    return 'has a buffer of whole minutes';
  }

  return undefined;
}
