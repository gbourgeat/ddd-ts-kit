import type { MUTATION_LAYERS } from './mutation-layers';

/** The minimum mutation score of each layer, applied to every context: the share of mutants its tests kill, a floor a run must reach, not a goal. */
export type Mutation = Readonly<Record<(typeof MUTATION_LAYERS)[number], number>>;
