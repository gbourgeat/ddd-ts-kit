/**
 * The time a spec file may take, in milliseconds, when the config file says nothing: five seconds for
 * a unit spec, which runs the model and the use cases on fakes, thirty for an integration spec, which
 * opens a database or reaches a server. A budget is a floor on the speed of the loop, not a goal: a
 * slow spec hides a world rebuilt per test, I/O behind a fake, or a wait.
 */
export const REFERENCE_BUDGET = { unit: 5000, integration: 30_000 } as const satisfies Readonly<Record<string, number>>;

/** The levels held to a time budget, each with a budget of its own. */
export type BudgetLevel = keyof typeof REFERENCE_BUDGET;
