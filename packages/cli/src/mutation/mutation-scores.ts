import { type Config, MUTATION_LAYERS } from '../config';
import type { MutationReport } from './read-mutation-report';

/** A layer held to a mutation score. */
type ScoredLayer = (typeof MUTATION_LAYERS)[number];

/** What the tests of one layer of one context did with its mutants. */
export interface ContextScore {
  readonly context: string;
  readonly layer: ScoredLayer;
  /** Mutants a test noticed: killed, or run out of time. */
  readonly detected: number;
  /** Mutants no test noticed: survived, or covered by no test at all. */
  readonly undetected: number;
  /** Mutants Stryker could not judge, an error at load or compile time: left out of the score. */
  readonly errors: number;
  /**
   * Mutants the measure leaves out on purpose: the texts of refusals, and the static mutants, in code
   * that runs once when the module loads. The score says nothing about them: a rule written as a
   * declaration is proven by the test that states it alone.
   */
  readonly ignored: number;
  /** The share of detected mutants, as Stryker computes it, 100 when nothing was mutated. */
  readonly score: number;
  /** The floor of the config for the layer. */
  readonly floor: number;
  readonly held: boolean;
}

interface Counts {
  detected: number;
  undetected: number;
  errors: number;
  ignored: number;
}

const DETECTED = new Set(['Killed', 'Timeout']);
const UNDETECTED = new Set(['Survived', 'NoCoverage']);

/**
 * The score of each layer of each context the report holds, held to the floor of the config for
 * that layer. A mutant is counted under the context and the layer its file belongs to; a file
 * outside the contexts directory, or outside the layers held, is left out, as `governedMutation`
 * mutates nothing there.
 */
export function mutationScores(report: MutationReport, config: Config): ContextScore[] {
  const prefix = `${config.contextsDir}/`;
  const counted = new Map<string, Counts>();

  for (const [file, mutants] of Object.entries(report)) {
    const context = file.startsWith(prefix) ? file.slice(prefix.length).split('/')[0] : undefined;
    const layer = layerOf(file);

    if (context === undefined || context === '' || layer === undefined) {
      continue;
    }

    const key = `${context}/${layer}`;

    counted.set(key, tallied(mutants, counted.get(key) ?? { detected: 0, undetected: 0, errors: 0, ignored: 0 }));
  }

  return [...counted.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, counts]) => scored(key, counts, config));
}

function tallied(mutants: readonly { readonly status: string }[], counts: Counts): Counts {
  for (const { status } of mutants) {
    if (DETECTED.has(status)) {
      counts.detected += 1;
    } else if (UNDETECTED.has(status)) {
      counts.undetected += 1;
    } else if (status === 'Ignored') {
      counts.ignored += 1;
    } else {
      counts.errors += 1;
    }
  }

  return counts;
}

/** The layer a mutated file belongs to: the first layer folder of its path inside the context, in a module of the model too. */
function layerOf(file: string): ScoredLayer | undefined {
  return MUTATION_LAYERS.find((layer) => file.includes(`/${layer}/`));
}

function scored(key: string, { detected, undetected, errors, ignored }: Counts, config: Config): ContextScore {
  const [context = '', found] = key.split('/');
  const layer = MUTATION_LAYERS.find((candidate) => candidate === found) ?? 'domain';
  const floor = config.mutation[layer];
  const judged = detected + undetected;
  const score = judged === 0 ? 100 : (100 * detected) / judged;

  return { context, layer, detected, undetected, errors, ignored, score, floor, held: score >= floor };
}
