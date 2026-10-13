import { describe, expect, it } from 'vitest';
import { OccupancyFigures } from '@/contexts/analytics/domain/value-objects/occupancy-figures.vo';

const DAY = {
  heldMinutes: 90,
  appointmentsHeld: 3,
  completed: 1,
  noShows: 1,
  cancelledByPatient: 2,
  cancelledByPractice: 0,
};

describe('OccupancyFigures', () => {
  it('is equal to other figures with the same counts and minutes', () => {
    const figures = OccupancyFigures.of(DAY);

    expect(figures.equals(OccupancyFigures.of({ ...DAY }))).toBe(true);
    expect(figures.equals(OccupancyFigures.of({ ...DAY, noShows: 2 }))).toBe(false);
  });

  it('reads the time held and the appointments that hold it', () => {
    const figures = OccupancyFigures.of(DAY);

    expect(figures.heldMinutes).toBe(90);
    expect(figures.appointmentsHeld).toBe(3);
  });

  it('gives its figures as the line of a read model takes them', () => {
    expect(OccupancyFigures.of(DAY).toJSON()).toEqual(DAY);
  });
});
