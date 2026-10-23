import type { Amendment } from './acceptance-lock';
import type { AcceptanceProblem } from './acceptance-problem';
import type { Criterion } from './criteria-in';
import type { RegressionSpec } from './regression-spec';
import type { Scenario } from './scenario';

/** One row of a story and the scenarios that name it. */
export interface RowAcceptance {
  readonly id: string;
  readonly kind: string;
  readonly slice: string;
  readonly status: string;
  readonly scenarios: readonly Scenario[];
}

/** The acceptance of one story: its spec, its rows, the scenarios of each and what is wrong. */
export interface StoryAcceptance {
  readonly story: string;
  /** The acceptance spec, relative to the root; undefined when the story has none yet. */
  readonly file?: string;
  /** The specification of the story, relative to the root; undefined when it has none. */
  readonly specification?: string;
  readonly rows: readonly RowAcceptance[];
  readonly criteria: readonly Criterion[];
  readonly scenarios: readonly Scenario[];
  /** The regression specs of a fix, those `## Regression` of its story file lists; undefined for a story. */
  readonly regression?: readonly RegressionSpec[];
  /** The lock file, when the acceptance is locked. */
  readonly lock?: string;
  /** The changes since a lock the acceptance-judge agent let through, with its verdicts: for the owner to validate. */
  readonly amendments: readonly Amendment[];
  readonly problems: readonly AcceptanceProblem[];
}
