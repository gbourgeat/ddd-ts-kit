import { roleOf } from '../canonical.js';
import type { Rule, Violation } from '../types.js';
import { inContext, reporter } from './helpers.js';

const EXPORTED_CLASS = /(?<![\w$.])export\s+(?:default\s+)?(?:abstract\s+)?class\s+([\w$]+)/g;

export const namingOneConceptPerFile: Rule = {
  id: 'naming/one-concept-per-file',
  description: 'One exported aggregate, entity, value object, event or handler per file.',
  scope: 'file',
  run(project) {
    const report = reporter(project, this.id);
    const violations: Violation[] = [];
    for (const file of project.files) {
      if (!inContext(file.location) || file.isTest) continue;
      const { layer, inside } = file.location;
      const directory = [layer, ...inside.slice(0, -1)].join('/');
      if (roleOf(directory)?.oneConcept !== true) continue;
      const classes = [...file.scan.code.matchAll(EXPORTED_CLASS)];
      const [first, second] = classes;
      if (first === undefined || second === undefined) continue;
      violations.push(
        report(
          { file: file.path, line: file.scan.lineAt(second.index) },
          `The file exports ${classes.length} classes (${classes.map((match) => match[1]).join(', ')}).`,
          `Keep ${first[1] ?? 'the first class'} here and move each other class to its own file named after it.`,
        ),
      );
    }
    return violations;
  },
};
