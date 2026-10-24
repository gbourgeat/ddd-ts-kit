import type { Budget } from './budget';

/**
 * The budgets of the reference: five seconds for a unit spec file, which runs the model and the use
 * cases on fakes, thirty for an integration spec file, which opens a database or reaches a server. A
 * project may lower either freely; raising one accepts slower specs and is a recorded deviation.
 */
export const REFERENCE_BUDGET: Budget = { unit: 5000, integration: 30_000 };
