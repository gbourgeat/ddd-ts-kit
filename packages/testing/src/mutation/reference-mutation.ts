/**
 * The floors a project is held to when its config file says nothing, the same ones `ddd-ts-kit check`
 * reads a lowered floor against: of the mutants of the domain layer of a context, the texts of its
 * refusals left out, its tests kill at least eighty of a hundred; of those of its application layer,
 * seventy-five.
 */
export const REFERENCE_MUTATION = { domain: 80, application: 75 } as const satisfies Readonly<Record<string, number>>;

/** The layers held to a mutation score, each with a floor of its own. */
export type MutationLayer = keyof typeof REFERENCE_MUTATION;
