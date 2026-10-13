import { Criteria, cursorPage, evaluateCriteria, scoped, type Page, type ScopedCriteria } from '@ddd-ts-kit/kernel';
import {
  occupancyCriteria,
  type Occupancy,
  type OccupancyReader,
} from '@/contexts/analytics/application/ports/occupancy-reader.port';
import type { Outcome, OutcomeRegister } from '@/contexts/analytics/application/ports/outcome-register.port';
import { OccupancyMeasureService } from '@/contexts/analytics/domain/services/occupancy-measure.service';
import { MeasuredOutcome } from '@/contexts/analytics/domain/value-objects/measured-outcome.vo';

const measure = new OccupancyMeasureService();

/** The occupancy in memory, measured by the domain service from the outcomes of the register it is given: what the adapter over the database is held to. */
export class FakeOccupancyReader implements OccupancyReader {
  constructor(private readonly outcomes: OutcomeRegister) {}

  async search(criteria: ScopedCriteria<Occupancy>): Promise<Page<Occupancy>> {
    return evaluateCriteria(occupancyCriteria, measured(await everyOutcome(this.outcomes)), criteria);
  }
}

async function everyOutcome(register: OutcomeRegister): Promise<readonly Outcome[]> {
  const outcomes: Outcome[] = [];
  let cursor: string | undefined;

  do {
    const page = await register.search(
      scoped(Criteria.of<Outcome>().page(cursorPage(cursor === undefined ? { limit: 100 } : { cursor, limit: 100 })), {
        kind: 'all',
      }),
    );

    outcomes.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor !== undefined);

  return outcomes;
}

function measured(outcomes: readonly Outcome[]): readonly Occupancy[] {
  const lines = new Map<string, Outcome[]>();

  for (const outcome of outcomes) {
    const key = `${outcome.practiceId} ${outcome.calendarId} ${outcome.day}`;

    lines.set(key, [...(lines.get(key) ?? []), outcome]);
  }

  return [...lines.values()].flatMap((onTheLine) => {
    const [first] = onTheLine;

    if (first === undefined) {
      return [];
    }

    const { practiceId, calendarId, day } = first;

    const figures = measure.measure(
      onTheLine.map(({ state, startsAt, endsAt }) => MeasuredOutcome.of(state, startsAt, endsAt)),
    );

    return [{ id: `${calendarId}.${day}`, practiceId, calendarId, day, ...figures.toJSON() }];
  });
}
