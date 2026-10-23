import type { RuleSetting } from './rule-setting';

/** The severity a setting gives the whole project; a setting for some files leaves the default to the others. */
export function projectSeverity(setting: RuleSetting | undefined): string | undefined {
  return typeof setting === 'string' ? setting : undefined;
}
