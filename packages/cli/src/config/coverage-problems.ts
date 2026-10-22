import { COVERAGE_LAYERS } from './coverage-layers';
import { COVERAGE_METRICS } from './coverage-metrics';
import { isOneOf } from './is-one-of';
import { isRate } from './is-rate';
import { REFERENCE_COVERAGE } from './reference-coverage';
import { isRecord } from './values/is-record';

/** Something written under `coverage` that is not read as written. */
export interface CoverageProblem {
  /** The keys of the config file that lead to the problem, outermost first. */
  readonly where: readonly string[];
  readonly message: string;
  readonly fix: string;
}

const SHAPE = `{ "<layer>": { "<rate>": <0 to 100> } } with the layers ${COVERAGE_LAYERS.join(', ')} and the rates ${COVERAGE_METRICS.join(', ')}`;

/** What the raw `coverage` value of a config says that the parser replaces by the reference or ignores. */
export function coverageProblems(value: unknown): CoverageProblem[] {
  if (value === undefined) {
    return [];
  }

  if (!isRecord(value)) {
    return [
      {
        where: ['"coverage"'],
        message: '"coverage" is not an object: the thresholds of the reference are used.',
        fix: `Write it as ${SHAPE}, or remove it.`,
      },
    ];
  }

  return Object.entries(value).flatMap(([layer, rates]) => layerProblems(layer, rates));
}

function layerProblems(layer: string, rates: unknown): CoverageProblem[] {
  if (!isOneOf(COVERAGE_LAYERS, layer)) {
    return [
      {
        where: ['"coverage"', `"${layer}"`],
        message: `"coverage.${layer}" is not a measured layer: it is ignored.`,
        fix: `Use only: ${COVERAGE_LAYERS.join(', ')}.`,
      },
    ];
  }

  if (!isRecord(rates)) {
    return [
      {
        where: ['"coverage"', `"${layer}"`],
        message: `"coverage.${layer}" is not an object: the thresholds of the reference are used.`,
        fix: `Write it as ${JSON.stringify(REFERENCE_COVERAGE[layer])}, or remove it.`,
      },
    ];
  }

  return Object.entries(rates).flatMap(([metric, rate]) => rateProblems(layer, metric, rate));
}

function rateProblems(layer: (typeof COVERAGE_LAYERS)[number], metric: string, rate: unknown): CoverageProblem[] {
  const where = ['"coverage"', `"${layer}"`, `"${metric}"`];

  if (!isOneOf(COVERAGE_METRICS, metric)) {
    return [
      {
        where,
        message: `"coverage.${layer}.${metric}" is not a rate: it is ignored.`,
        fix: `Use only: ${COVERAGE_METRICS.join(', ')}.`,
      },
    ];
  }

  if (isRate(rate)) {
    return [];
  }

  const reference = REFERENCE_COVERAGE[layer][metric];

  return [
    {
      where,
      message: `"coverage.${layer}.${metric}" is ${JSON.stringify(rate)}: it is read as ${reference}.`,
      fix: `Set it to a percentage between 0 and 100, or remove it to keep ${reference}.`,
    },
  ];
}
