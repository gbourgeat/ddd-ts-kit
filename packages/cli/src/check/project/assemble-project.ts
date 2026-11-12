import { isOneOf, projectSeverity, SEVERITIES, type Severity } from '../../config';
import { DEFAULT_SEVERITIES } from '../catalogue/default-severities';
import type { Project } from '../model/project';
import { fileSeverity } from './file-severity';
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
