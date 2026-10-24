import type { Config } from '../config';
import type { MutationReport } from './read-mutation-report';

/** What the tests of the domain layer of one context did with its mutants. */
export interface ContextScore {
  readonly context: string;
  /** Mutants a test noticed: killed, or run out of time. */
  readonly detected: number;
  /** Mutants no test noticed: survived, or covered by no test at all. */
  readonly undetected: number;
  /** Mutants Stryker could not judge, an error at load or compile time: left out of the score. */
  readonly errors: number;
  /** The share of detected mutants, as Stryker computes it, 100 when nothing was mutated. */
  readonly score: number;
  /** The floor of the config for the layer. */
  readonly floor: number;
  readonly held: boolean;
}

const DETECTED = new Set(['Killed', 'Timeout']);
const UNDETECTED = new Set(['Survived', 'NoCoverage']);

/**
 * The score of the domain layer of each context the report holds, held to the floor of the
 * config. A mutant is counted under the context its file belongs to; a file outside the contexts
 * directory is left out, as `governedMutation` mutates nothing there.
 */
export function mutationScores(report: MutationReport, config: Config): ContextScore[] {
  const prefix = `${config.contextsDir}/`;
  const byContext = new Map<string, { detected: number; undetected: number; errors: number }>();

  for (const [file, mutants] of Object.entries(report)) {
    const context = file.startsWith(prefix) ? file.slice(prefix.length).split('/')[0] : undefined;

    if (context === undefined || context === '') {
      continue;
    }

    const counts = byContext.get(context) ?? { detected: 0, undetected: 0, errors: 0 };

    for (const { status } of mutants) {
      if (DETECTED.has(status)) {
        counts.detected += 1;
      } else if (UNDETECTED.has(status)) {
        counts.undetected += 1;
      } else if (status !== 'Ignored') {
        counts.errors += 1;
      }
    }

    byContext.set(context, counts);
  }

  return [...byContext.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([context, counts]) => scored(context, counts, config.mutation.domain));
}

function scored(
  context: string,
  { detected, undetected, errors }: { detected: number; undetected: number; errors: number },
  floor: number,
): ContextScore {
  const judged = detected + undetected;
  const score = judged === 0 ? 100 : (100 * detected) / judged;

  return { context, detected, undetected, errors, score, floor, held: score >= floor };
}
