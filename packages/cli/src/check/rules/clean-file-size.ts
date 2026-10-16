import type { Finding } from '../model/finding.js';
import type { Rule } from '../model/rule.js';
import type { SourceFile } from '../model/source-file.js';
import { besideTheSources } from '../project/beside-the-sources.js';
import { isGeneratedContextFile } from '../support/is-generated-context-file.js';
import { perFile } from '../support/per-file.js';
import { reporter } from '../support/reporter.js';
import { toViolations } from '../support/to-violations.js';

const MAX_FILE_LINES = 350;

export const cleanFileSize: Rule = {
  id: 'clean/file-size',
  description: `A file is at most ${MAX_FILE_LINES} lines, sources and tests alike, under the source root, \`test/\` (end-to-end specs included) and \`scripts/\`: past that it holds more than one responsibility.`,
  scope: 'file',
  run(project) {
    return perFile(project, this.id, tooLong);
  },
  acrossProject(project) {
    const report = reporter(project, this.id);

    return besideTheSources(project).flatMap((file) => toViolations(report, file.path, tooLong(file)));
  },
};

function tooLong(file: SourceFile): Finding[] {
  const lines = file.text.split('\n').length - (file.text.endsWith('\n') ? 1 : 0);

  if (lines <= MAX_FILE_LINES || isGenerated(file)) {
    return [];
  }

  return [
    {
      line: MAX_FILE_LINES + 1,
      message: `The file is ${lines} lines long (limit ${MAX_FILE_LINES}).`,
      fix: 'Split it by responsibility: move each concept (a class, a function with its helpers, a family of cases) to its own file named after it.',
    },
  ];
}

/** A file written by a tool: under a directory named `generated`, or the barrel or dependency file of a context. */
function isGenerated(file: SourceFile): boolean {
  return file.path.split('/').includes('generated') || isGeneratedContextFile(file);
}
