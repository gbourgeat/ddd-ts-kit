import { isOneOf, SEVERITIES, type Config, type Severity } from '../../config';
import { matchesGlob } from '../exports/matches-glob';

/** The severity a setting for some files gives `file`; undefined when no such setting names it. */
export function fileSeverity(config: Config, ruleId: string, file: string): Severity | undefined {
  const setting = config.rules[ruleId];

  if (setting === undefined || typeof setting === 'string' || !isOneOf(SEVERITIES, setting.severity)) {
    return undefined;
  }

  return setting.files.some((glob) => matchesGlob(glob, file)) ? setting.severity : undefined;
}
