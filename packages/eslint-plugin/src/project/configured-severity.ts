import type { Severity, Config } from './config.js';

/** The severity `rules.<id>` gives the whole project; a setting for some files gives none. */
export function configuredSeverity(config: Config, ruleId: string): Severity | undefined {
  const configured = config.rules[ruleId];

  return configured === 'error' || configured === 'warn' || configured === 'off' ? configured : undefined;
}
