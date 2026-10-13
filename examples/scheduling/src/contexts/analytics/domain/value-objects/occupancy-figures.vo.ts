import { ValueObject } from '@ddd-ts-kit/kernel';

/** The occupancy of a calendar over a day. */
export type OccupancyFiguresProps = {
  /** The minutes of the appointments that hold their time: held, completed or missed by the patient. Each appointment counts to the nearest minute. */
  readonly heldMinutes: number;
  /** How many appointments hold their time. */
  readonly appointmentsHeld: number;
  readonly completed: number;
  readonly noShows: number;
  readonly cancelledByPatient: number;
  readonly cancelledByPractice: number;
};

/** The figures of one line of occupancy, as the measure gives them: equal figures are the same occupancy. */
export class OccupancyFigures extends ValueObject<OccupancyFiguresProps> {
  private constructor(props: OccupancyFiguresProps) {
    super(props);
  }

  static of(props: OccupancyFiguresProps): OccupancyFigures {
    return new OccupancyFigures(props);
  }

  get heldMinutes(): number {
    return this.props.heldMinutes;
  }

  get appointmentsHeld(): number {
    return this.props.appointmentsHeld;
  }
}
