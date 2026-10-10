import { isOneOf, SEVERITIES } from '../../config/index.js';
import { DEFAULT_SEVERITIES } from '../catalogue/default-severities.js';
import type { Project } from '../model/project.js';
import { locate } from './locate.js';

/** Gives what was loaded the two questions every rule asks: the severity of a rule and the place of a file. */
export function assembleProject(loaded: Omit<Project, 'severity' | 'locate'>): Project {
  const { config } = loaded;

  return {
    ...loaded,
    severity: (ruleId) => {
      const configured = config.rules[ruleId];

      return isOneOf(SEVERITIES, configured) ? configured : (DEFAULT_SEVERITIES[ruleId] ?? 'error');
    },
    locate: (file) => locate(config, file),
  };
}
