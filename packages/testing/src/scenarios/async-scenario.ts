import type { AsyncOutcome } from './async-outcome';

export interface AsyncScenario<A> {
  when(action: (aggregate: A) => unknown): AsyncOutcome<A>;
}
