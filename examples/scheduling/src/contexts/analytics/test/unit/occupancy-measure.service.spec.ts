import { describe, expect, it } from 'vitest';
import { OccupancyMeasureService } from '@/contexts/analytics/domain/services/occupancy-measure.service';
import { MeasuredOutcome } from '@/contexts/analytics/domain/value-objects/measured-outcome.vo';
import { OccupancyFigures } from '@/contexts/analytics/domain/value-objects/occupancy-figures.vo';
import type { OutcomeState } from '@/contexts/analytics/domain/vocabularies/outcome-state.vocabulary';

const measure = new OccupancyMeasureService();

const NOTHING = {
  heldMinutes: 0,
  appointmentsHeld: 0,
  completed: 0,
  noShows: 0,
  cancelledByPatient: 0,
  cancelledByPractice: 0,
};

describe('OccupancyMeasureService', () => {
  it('holds no state of its own', () => {
    expect(Object.keys(new OccupancyMeasureService())).toEqual([]);
  });

  it('measures an empty day as nothing held and nothing counted', () => {
    expect(measure.measure([]).equals(OccupancyFigures.of(NOTHING))).toBe(true);
  });

  it('holds the time of the appointments held, completed and missed by the patient', () => {
    const figures = measure.measure([anOutcome('held', 30), anOutcome('completed', 45), anOutcome('no-show', 15)]);

    expect(figures.toJSON()).toMatchObject({ heldMinutes: 90, appointmentsHeld: 3, completed: 1, noShows: 1 });
  });

  it('counts the time of each appointment to the nearest minute', () => {
    const figures = measure.measure([anOutcome('held', 20.5), anOutcome('held', 10.5)]);

    expect(figures.heldMinutes).toBe(32);
    expect(figures.appointmentsHeld).toBe(2);
  });

  it('frees the time of a cancelled or expired appointment, and counts the cancellations by party', () => {
    const figures = measure.measure([
      anOutcome('held', 30),
      anOutcome('cancelled-by-patient', 30),
      anOutcome('cancelled-by-patient', 30),
      anOutcome('cancelled-by-practice', 60),
      anOutcome('expired', 30),
    ]);

    expect(figures.toJSON()).toEqual({
      ...NOTHING,
      heldMinutes: 30,
      appointmentsHeld: 1,
      cancelledByPatient: 2,
      cancelledByPractice: 1,
    });
  });
});

function anOutcome(state: OutcomeState, minutes: number): MeasuredOutcome {
  const startsAt = new Date('2026-10-12T08:00:00.000Z');

  return MeasuredOutcome.of(state, startsAt, new Date(startsAt.getTime() + minutes * 60_000));
}
