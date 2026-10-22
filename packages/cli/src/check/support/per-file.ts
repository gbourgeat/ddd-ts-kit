import type { Finding } from '../model/finding';
import type { Project } from '../model/project';
import type { SourceFile } from '../model/source-file';
import type { Violation } from '../model/violation';
import { reporter } from './reporter';
import { toViolations } from './to-violations';

/** Runs a judgment on each source of the project and reports what it finds under the rule `ruleId`. */
export function perFile(
  project: Project,
  ruleId: string,
  judge: (file: SourceFile) => readonly Finding[],
): Violation[] {
  const report = reporter(project, ruleId);

  return project.files.flatMap((file) => toViolations(report, file.path, judge(file)));
}
