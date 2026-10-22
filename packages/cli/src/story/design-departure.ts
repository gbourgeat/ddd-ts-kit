import type { CitedKind } from '../citations/cited-name';

/**
 * A name the design review of a done row cites that the code does not have, and that the report
 * of the story does not list as a compromise: the row departed from its design, and nothing says so.
 */
export interface DesignDeparture {
  /** The done row whose section cites the name. */
  readonly row: string;
  /** The design review, relative to the project root, and the line of the citation. */
  readonly document: string;
  readonly line: number;
  readonly cited: string;
  readonly kind: CitedKind;
  /** What the code lacks: the file, the class or the member. */
  readonly why: string;
  /** What settles it. */
  readonly fix: string;
}
