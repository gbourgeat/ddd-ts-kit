import type { Violation } from './violation';

/** Where a violation is reported: a file of the project and a 1-based line. */
interface Place {
  readonly file: string;
  readonly line: number;
}

export type Report = (at: Place, message: string, fix: string) => Violation;
