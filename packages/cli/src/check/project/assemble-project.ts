import { isOneOf, projectSeverity, SEVERITIES, type Config, type Severity } from '../../config';
import { DEFAULT_SEVERITIES } from '../catalogue/default-severities';
import { matchesGlob } from '../exports/matches-glob';
import type { Project } from '../model/project';
import { locate } from './locate';

/** Gives what was loaded the questions every rule asks: the severity of a rule, on a file or not, and the place of a file. */
export function assembleProject(loaded: Omit<Project, 'severity' | 'fileSeverity' | 'locate'>): Project {
  const { config } = loaded;

  const severity = (ruleId: string): Severity => {
    const configured = projectSeverity(config.rules[ruleId]);

    return isOneOf(SEVERITIES, configured) ? configured : (DEFAULT_SEVERITIES[ruleId] ?? 'error');
  };

  return {
    ...loaded,
    severity,
    fileSeverity: (ruleId, file) => fileSeverity(config, ruleId, file),
    locate: (file) => locate(config, file),
  };
}

function fileSeverity(config: Config, ruleId: string, file: string): Severity | undefined {
  const setting = config.rules[ruleId];

  if (setting === undefined || typeof setting === 'string' || !isOneOf(SEVERITIES, setting.severity)) {
    return undefined;
  }

  return setting.files.some((glob) => matchesGlob(glob, file)) ? setting.severity : undefined;
}
