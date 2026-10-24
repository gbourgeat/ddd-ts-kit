import { budgetProblems, CONFIG_FILE, coverageProblems, mutationProblems } from '../../config';
import type { Project } from '../model/project';
import type { Report } from '../model/report';
import type { Violation } from '../model/violation';
import { lineOfSequence } from '../support/line-of-sequence';
import { rawConfig } from './raw-config';

/**
 * What the config says of the measures of the tests that no run reads as written: a coverage
 * threshold or a mutation floor that is not a percentage, a time budget that is not a duration,
 * each read as the reference, and a layer or a level that is not held, ignored.
 */
export function measureSettings(project: Project, report: Report): Violation[] {
  const raw = rawConfig(project);

  return [
    ...coverageProblems(raw['coverage']),
    ...mutationProblems(raw['mutation']),
    ...budgetProblems(raw['budget']),
  ].map(({ where, message, fix }) =>
    report({ file: CONFIG_FILE, line: lineOfSequence(project.configText, where) }, message, fix),
  );
}
