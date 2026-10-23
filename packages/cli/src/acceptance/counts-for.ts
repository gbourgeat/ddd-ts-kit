import type { AcceptanceGate } from './acceptance-gate';
import type { AcceptanceProblem } from './acceptance-problem';

/** True when the problem keeps a story from the gate; without a gate, only the inconsistencies count. */
export function countsFor(problem: AcceptanceProblem, gate: AcceptanceGate | undefined): boolean {
  if (problem.from === undefined) {
    return true;
  }

  return gate === 'passing' || (gate === 'written' && problem.from === 'written');
}
