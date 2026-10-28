import type { Violation } from './violation';

/** Where a violation is reported: a file of the project and a 1-based line. */
interface Place {
  readonly file: string;
  readonly line: number;
  /** The other files the finding is repaired in. */
  readonly subjects?: readonly string[] | undefined;
}

export type Report = (at: Place, message: string, fix: string) => Violation;
