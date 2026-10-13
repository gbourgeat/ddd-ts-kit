import { ValueObject } from '@ddd-ts-kit/kernel';
import { OccupancyError } from '@/contexts/analytics/domain/errors/occupancy.error';

/** The occupancy of a calendar over a day. */
export type OccupancyFiguresProps = {
  /** The minutes of the appointments that hold their time: held, completed or missed by the patient. Each appointment counts to the nearest minute. */
  readonly heldMinutes: number;
  /** How many appointments hold their time: those completed and those missed among them. */
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

  /**
   * Refuses figures no set of outcomes gives: a count or a number of minutes below zero or not
   * whole, and fewer appointments held than those completed and those missed, which hold their
   * time too.
   */
  static of(props: OccupancyFiguresProps): OccupancyFigures {
    if (!Object.values(props).every((figure) => Number.isInteger(figure) && figure >= 0)) {
      throw OccupancyError.figuresInconsistent('are whole numbers, none below zero');
    }

    if (props.appointmentsHeld < props.completed + props.noShows) {
      throw OccupancyError.figuresInconsistent('hold at least the appointments completed and those missed');
    }

    return new OccupancyFigures(props);
  }

  get heldMinutes(): number {
    return this.props.heldMinutes;
  }

  get appointmentsHeld(): number {
    return this.props.appointmentsHeld;
  }
}
