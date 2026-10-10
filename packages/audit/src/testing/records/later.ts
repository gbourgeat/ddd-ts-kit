/** The instant the records of the contract occurred at, unless they say otherwise. */
export const NOW = new Date('2026-03-01T10:00:00.000Z');

export function later(seconds: number): Date {
  return new Date(NOW.getTime() + seconds * 1000);
}
