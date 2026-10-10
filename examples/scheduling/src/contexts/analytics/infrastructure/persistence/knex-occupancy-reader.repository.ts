import type { Knex } from 'knex';
import { pageOfPlan, planCriteria, type CriteriaPlan, type Page, type ScopedCriteria } from '@ddd-ts-kit/kernel';
import { Repository } from '@ddd-ts-kit/kernel/declarations';
import { KnexContext, criteriaToKnex, predicateToKnex } from '@ddd-ts-kit/knex';
import { OccupancyReader, occupancyCriteria, type Occupancy } from '../../application/ports/occupancy-reader.port.js';
import { OccupancyMeasureService } from '../../domain/services/occupancy-measure.service.js';
import { ANALYTICS_SCHEMA } from './analytics.schema.js';

/** What a line is grouped by, and so what a filter or a scope may name: each is a column of the outcomes. */
const GROUPED = { practiceId: 'practice_id', calendarId: 'calendar_id', day: 'day' };

const MEASURED = {
  id: 'id',
  ...GROUPED,
  heldMinutes: 'held_minutes',
  appointmentsHeld: 'appointments_held',
  completed: 'completed',
  noShows: 'no_shows',
  cancelledByPatient: 'cancelled_by_patient',
  cancelledByPractice: 'cancelled_by_practice',
};

interface MeasuredLine {
  readonly id: string;
  readonly practice_id: string;
  readonly calendar_id: string;
  readonly day: string;
  readonly held_minutes: number;
  readonly appointments_held: number;
  readonly completed: number;
  readonly no_shows: number;
  readonly cancelled_by_patient: number;
  readonly cancelled_by_practice: number;
  readonly lines: number;
}

/**
 * Measures the occupancy when it is read, in one statement over the outcomes: the filters and
 * the scope of the actor narrow the outcomes before they are grouped, the order and the page
 * apply to the lines.
 */
@Repository(OccupancyReader, [KnexContext])
export class KnexOccupancyReader implements OccupancyReader {
  constructor(private readonly database: KnexContext) {}

  async search(criteria: ScopedCriteria<Occupancy>): Promise<Page<Occupancy>> {
    const plan = planCriteria(occupancyCriteria, criteria);

    if (plan.empty) {
      return pageOfPlan(plan, [], 0);
    }

    const knex = this.database.executor();
    const page = knex.select<MeasuredLine[]>('*').from(measured(knex, plan).as('occupancy'));
    const lines = await criteriaToKnex(page, { ...plan, filter: undefined }, MEASURED);

    return pageOfPlan(plan, lines.map(toOccupancy), plan.kind === 'offset' ? await this.total(plan, lines) : undefined);
  }

  /** Every line carries the count of the lines; a page past the last one carries none, and is the only read that counts apart. */
  private async total(plan: CriteriaPlan, lines: readonly MeasuredLine[]): Promise<number> {
    const [first] = lines;

    if (first !== undefined) {
      return first.lines;
    }

    if (plan.offset === 0) {
      return 0;
    }

    const knex = this.database.executor();

    const counted = await knex
      .count<{ lines: string | number }[]>({ lines: '*' })
      .from(grouped(knex, plan).select('day').as('occupancy'));

    return Number(counted[0]?.lines ?? 0);
  }
}

function measured(knex: Knex, plan: CriteriaPlan): Knex.QueryBuilder {
  const holding = [...OccupancyMeasureService.HOLDING];
  const among = holding.map(() => '?').join(', ');

  return grouped(knex, plan).select(
    'practice_id',
    'calendar_id',
    'day',
    knex.raw("calendar_id || '.' || day as id"),
    knex.raw(
      `coalesce(sum(round(extract(epoch from (ends_at - starts_at)) / 60)) filter (where state in (${among})), 0)::integer as held_minutes`,
      holding,
    ),
    knex.raw(`(count(*) filter (where state in (${among})))::integer as appointments_held`, holding),
    counted(knex, 'completed', 'completed'),
    counted(knex, 'no-show', 'no_shows'),
    counted(knex, 'cancelled-by-patient', 'cancelled_by_patient'),
    counted(knex, 'cancelled-by-practice', 'cancelled_by_practice'),
    knex.raw('(count(*) over ())::integer as lines'),
  );
}

/** The outcomes the filters and the scope keep, one group per calendar and day; an outcome a rebuild left as removed is not counted. */
function grouped(knex: Knex, plan: CriteriaPlan): Knex.QueryBuilder {
  const outcomes = knex('outcomes').withSchema(ANALYTICS_SCHEMA).where('deleted', false);

  return predicateToKnex(outcomes, plan.filter, GROUPED).groupBy('practice_id', 'calendar_id', 'day');
}

function counted(knex: Knex, state: string, column: string): Knex.Raw {
  return knex.raw('(count(*) filter (where state = ?))::integer as ??', [state, column]);
}

function toOccupancy(line: MeasuredLine): Occupancy {
  return {
    id: line.id,
    practiceId: line.practice_id,
    calendarId: line.calendar_id,
    day: line.day,
    heldMinutes: line.held_minutes,
    appointmentsHeld: line.appointments_held,
    completed: line.completed,
    noShows: line.no_shows,
    cancelledByPatient: line.cancelled_by_patient,
    cancelledByPractice: line.cancelled_by_practice,
  };
}
