/** Milliseconds as hours, to one decimal. */
export function hours(milliseconds: number): number {
  return Math.round(milliseconds / 360_000) / 10;
}
