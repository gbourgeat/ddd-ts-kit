import { ValueObject } from '@ddd-ts-kit/kernel';
import { InvalidWaiter } from '@/contexts/scheduling/domain/errors/invalid-waiter.error';

export type WaiterProps = {
  readonly patientId: string;
  readonly appointmentTypeId: string;
  readonly joinedAt: Date;
};

/** A patient on a waitlist, for an appointment type. */
export class Waiter extends ValueObject<WaiterProps> {
  private constructor(props: WaiterProps) {
    super(props);
  }

  static create(props: WaiterProps): Waiter {
    if (props.patientId.trim().length === 0) {
      throw InvalidWaiter.forRule('names a patient');
    }

    if (props.appointmentTypeId.trim().length === 0) {
      throw InvalidWaiter.forRule('names an appointment type');
    }

    if (Number.isNaN(props.joinedAt.getTime())) {
      throw InvalidWaiter.forRule('joined at a real instant');
    }

    return new Waiter({
      patientId: props.patientId.trim(),
      appointmentTypeId: props.appointmentTypeId.trim(),
      joinedAt: new Date(props.joinedAt),
    });
  }

  get patientId(): string {
    return this.props.patientId;
  }

  get appointmentTypeId(): string {
    return this.props.appointmentTypeId;
  }

  get joinedAt(): Date {
    return new Date(this.props.joinedAt);
  }
}
