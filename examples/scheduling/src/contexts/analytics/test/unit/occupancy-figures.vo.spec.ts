import { describe, expect, it } from 'vitest';
import { expectRefusal } from '@ddd-ts-kit/testing';
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

  it('refuses a figure below zero or not whole', () => {
    expectRefusal(() => OccupancyFigures.of({ ...DAY, cancelledByPractice: -1 }), 'FIGURES_INCONSISTENT');
    expectRefusal(() => OccupancyFigures.of({ ...DAY, heldMinutes: 90.5 }), 'FIGURES_INCONSISTENT');
  });

  it('refuses fewer appointments held than those completed and those missed', () => {
    expectRefusal(() => OccupancyFigures.of({ ...DAY, appointmentsHeld: 1 }), 'FIGURES_INCONSISTENT');
  });

  it('gives its figures as the line of a read model takes them', () => {
    expect(OccupancyFigures.of(DAY).toJSON()).toEqual(DAY);
  });
});
