import type { Project } from '../model/project.js';
import type { Report } from '../model/report.js';

/** Gives findings the id of a rule and the severity the project sets for it. */
export function reporter(project: Project, ruleId: string): Report {
  const severity = project.severity(ruleId) === 'warn' ? 'warn' : 'error';

  return ({ file, line }, message, fix) => ({ ruleId, severity, file, line, message, fix });
}
