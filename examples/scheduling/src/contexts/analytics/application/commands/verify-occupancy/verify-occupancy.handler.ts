import { Criteria, cursorPage, scoped, type EventStamp, type Page, type ScopedCriteria } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { OccupancyMeasureService, type OccupancyFigures } from '../../../domain/services/occupancy-measure.service.js';
import { Day } from '../../../domain/value-objects/day.vo.js';
import { OccupancyRegister, type Occupancy } from '../../ports/occupancy-register.port.js';
import { OutcomeRegister, type Outcome } from '../../ports/outcome-register.port.js';
import { VerifyOccupancyCommand } from './verify-occupancy.command.js';
import { storableStamp } from '../../../../../shared-kernel/storable-stamp.js';

/** The day of the verification and the seven before it. */
const DAYS_BACK = 7;
const FIGURES = ['heldMinutes', 'appointmentsHeld', 'completed', 'noShows', 'cancelledByPatient', 'cancelledByPractice'] as const satisfies readonly (keyof OccupancyFigures)[];
const measure = new OccupancyMeasureService();

@CommandHandler(VerifyOccupancyCommand, [OutcomeRegister, OccupancyRegister])
export class VerifyOccupancyHandler implements CommandHandler<VerifyOccupancyCommand> {
  constructor(
    private readonly outcomes: OutcomeRegister,
    private readonly occupancy: OccupancyRegister,
  ) {}

  async execute(command: VerifyOccupancyCommand): Promise<void> {
    const until = Day.containing(command.scheduledAt);
    const period = [until.minus(DAYS_BACK).value, until.value] as const;
    const counted = countedAgain(await everyLine(this.outcomes, Criteria.of<Outcome>().where('day', 'between', period)));
    const kept = await everyLine(this.occupancy, Criteria.of<Occupancy>().where('day', 'between', period));
    // A scheduled instant carries milliseconds like any fact: stamped the way the projections stamp theirs, a verified line stays replaceable.
    const stamp: EventStamp = storableStamp({ eventId: `analytics.verify-occupancy:${command.scheduledAt.toISOString()}`, occurredAt: command.scheduledAt });

    for (const line of kept) {
      if (!counted.has(line.id)) counted.set(line.id, { ...line, ...measure.measure([]) });
    }

    for (const line of counted.values()) {
      const known = kept.find((candidate) => candidate.id === line.id);

      if (known === undefined || differs(known, line)) await this.occupancy.upsertIfNewer(line.id, stamp, () => line);
    }
  }
}

/** The occupancy of each calendar and day, counted from nothing from these outcomes. */
function countedAgain(outcomes: readonly Outcome[]): Map<string, Occupancy> {
  const counted = new Map<string, Occupancy>();

  for (const { practiceId, calendarId, day } of outcomes) {
    const id = `${calendarId}.${day}`;
    const onTheLine = outcomes.filter((outcome) => outcome.calendarId === calendarId && outcome.day === day);

    if (!counted.has(id)) counted.set(id, { id, practiceId, calendarId, day, ...measure.measure(onTheLine) });
  }

  return counted;
}

function differs(kept: Occupancy, counted: Occupancy): boolean {
  return FIGURES.some((figure) => kept[figure] !== counted[figure]);
}

/** A register, for what the verification reads of it. */
type Listed<Row> = {
  list(criteria: ScopedCriteria<Row>): Promise<Page<Row>>;
};

async function everyLine<Row>(register: Listed<Row>, criteria: Criteria<Row>): Promise<readonly Row[]> {
  const lines: Row[] = [];
  let cursor: string | undefined;

  do {
    const page = await register.list(scoped(criteria.page(cursorPage(cursor === undefined ? { limit: 100 } : { cursor, limit: 100 })), { kind: 'all' }));

    lines.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor !== undefined);

  return lines;
}
