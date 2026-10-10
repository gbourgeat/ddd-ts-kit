import { ValueObject, err, ok, type Result } from '@ddd-ts-kit/kernel';
import { InvalidWaiterError } from '#src/contexts/scheduling/domain/errors/invalid-waiter.error.js';

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

  static create(props: WaiterProps): Result<Waiter, InvalidWaiterError> {
    if (props.patientId.trim().length === 0) {
      return err(new InvalidWaiterError('names a patient'));
    }

    if (props.appointmentTypeId.trim().length === 0) {
      return err(new InvalidWaiterError('names an appointment type'));
    }

    if (Number.isNaN(props.joinedAt.getTime())) {
      return err(new InvalidWaiterError('joined at a real instant'));
    }

    return ok(
      new Waiter({
        patientId: props.patientId.trim(),
        appointmentTypeId: props.appointmentTypeId.trim(),
        joinedAt: new Date(props.joinedAt),
      }),
    );
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
