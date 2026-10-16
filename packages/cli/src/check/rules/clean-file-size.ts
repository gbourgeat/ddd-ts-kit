import type { Finding } from '../model/finding.js';
import type { Rule } from '../model/rule.js';
import type { SourceFile } from '../model/source-file.js';
import { besideTheSources } from '../project/beside-the-sources.js';
import { isGeneratedContextFile } from '../support/is-generated-context-file.js';
import { perFile } from '../support/per-file.js';
import { reporter } from '../support/reporter.js';
import { toViolations } from '../support/to-violations.js';

const MAX_FILE_LINES = 350;

const SPLIT_BY_RESPONSIBILITY =
  'Split it by responsibility: move each concept (a class, a function with its helpers, a family of cases) to its own file named after it.';

/**
 * An aggregate cannot hand its methods to another class without exposing its state: what moves
 * out is a decision, computed elsewhere and applied by the aggregate.
 */
const SPLIT_AN_AGGREGATE =
  'Move a decision out of the aggregate: a domain service of domain/services/ that takes the state (or a value of it) and returns the new state and its events, which the aggregate applies in its intention method; a value object for fields that travel together, with their rules; an entity for a part with its own identity. Never a public method that sets the state from outside, and never a shortened comment, test or written rule.';

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
      fix: file.path.endsWith('.aggregate.ts') ? SPLIT_AN_AGGREGATE : SPLIT_BY_RESPONSIBILITY,
    },
  ];
}

/** A file written by a tool: under a directory named `generated`, or the barrel or dependency file of a context. */
function isGenerated(file: SourceFile): boolean {
  return file.path.split('/').includes('generated') || isGeneratedContextFile(file);
}
