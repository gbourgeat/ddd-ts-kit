/** The layers of a context whose tests are held to a mutation score, each with a floor of its own: the domain, pure and the home of the rules, and the application, where a use case decides what it does with them. */
export const MUTATION_LAYERS = ['domain', 'application'] as const;
