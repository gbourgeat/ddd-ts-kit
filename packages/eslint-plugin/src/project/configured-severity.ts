import type { Severity, Config } from './config.js';

export function configuredSeverity(config: Config, ruleId: string): Severity | undefined {
  const configured = config.rules[ruleId];

  return configured === 'error' || configured === 'warn' || configured === 'off' ? configured : undefined;
}
