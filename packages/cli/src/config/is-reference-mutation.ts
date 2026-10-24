import type { Mutation } from './mutation';
import { MUTATION_LAYERS } from './mutation-layers';
import { REFERENCE_MUTATION } from './reference-mutation';

/** True when no floor departs from the reference: the config file then has nothing to say about the mutation score. */
export function isReferenceMutation(mutation: Mutation): boolean {
  return MUTATION_LAYERS.every((layer) => mutation[layer] === REFERENCE_MUTATION[layer]);
}
