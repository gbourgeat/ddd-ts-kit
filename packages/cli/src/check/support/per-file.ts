import type { Finding } from '../model/finding.js';
import type { Project } from '../model/project.js';
import type { SourceFile } from '../model/source-file.js';
import type { Violation } from '../model/violation.js';
import { reporter } from './reporter.js';
import { toViolations } from './to-violations.js';

/** Runs a judgment on each source of the project and reports what it finds under the rule `ruleId`. */
export function perFile(project: Project, ruleId: string, judge: (file: SourceFile) => readonly Finding[]): Violation[] {
  const report = reporter(project, ruleId);

  return project.files.flatMap((file) => toViolations(report, file.path, judge(file)));
}
