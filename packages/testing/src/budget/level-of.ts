import type { BudgetLevel } from './reference-budget';

/** The specs outside the contexts that are not held to a budget: a flow end to end, a story, the wiring of every context. */
const UNBUDGETED = /(?:^|\/)test\/(?:e2e|acceptance|architecture)\//;
/** An integration spec of a context by its folder, and a spec of the platform, whose adapters open a database or reach a server. */
const INTEGRATION = /\/test\/integration\/|(?:^|\/)platform\//;

/**
 * The level a spec file is held to: an integration spec of a context by its folder and a spec of the
 * platform at the integration level, every other spec of the contexts a unit spec, and nothing for
 * the specs of the application outside the contexts.
 */
export function levelOf(file: string): BudgetLevel | undefined {
  const slashed = file.replaceAll('\\', '/');

  if (!slashed.endsWith('.spec.ts') || UNBUDGETED.test(slashed)) {
    return undefined;
  }

  return INTEGRATION.test(slashed) ? 'integration' : 'unit';
}
