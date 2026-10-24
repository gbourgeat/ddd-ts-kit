import { isOneOf } from './is-one-of';
import { isRate } from './is-rate';
import { MUTATION_LAYERS } from './mutation-layers';
import { REFERENCE_MUTATION } from './reference-mutation';
import { isRecord } from './values/is-record';

/** Something written under `mutation` that is not read as written. */
export interface MutationProblem {
  /** The keys of the config file that lead to the problem, outermost first. */
  readonly where: readonly string[];
  readonly message: string;
  readonly fix: string;
}

const SHAPE = `{ "<layer>": <0 to 100> } with the layers ${MUTATION_LAYERS.join(', ')}`;

/** What the raw `mutation` value of a config says that the parser replaces by the reference or ignores. */
export function mutationProblems(value: unknown): MutationProblem[] {
  if (value === undefined) {
    return [];
  }

  if (!isRecord(value)) {
    return [
      {
        where: ['"mutation"'],
        message: '"mutation" is not an object: the floor of the reference is used.',
        fix: `Write it as ${SHAPE}, or remove it.`,
      },
    ];
  }

  return Object.entries(value).flatMap(([layer, score]) => layerProblems(layer, score));
}

function layerProblems(layer: string, score: unknown): MutationProblem[] {
  const where = ['"mutation"', `"${layer}"`];

  if (!isOneOf(MUTATION_LAYERS, layer)) {
    return [
      {
        where,
        message: `"mutation.${layer}" is not a layer held to a mutation score: it is ignored.`,
        fix: `Use only: ${MUTATION_LAYERS.join(', ')}.`,
      },
    ];
  }

  if (isRate(score)) {
    return [];
  }

  const reference = REFERENCE_MUTATION[layer];

  return [
    {
      where,
      message: `"mutation.${layer}" is ${JSON.stringify(score)}: it is read as ${reference}.`,
      fix: `Set it to a percentage between 0 and 100, or remove it to keep ${reference}.`,
    },
  ];
}
