import { declaredRoleOf } from '../../declared/index.js';
import { roleOf } from '../canonical/role-of.js';
import { classesOf } from '../declarations/classes-of.js';
import type { Finding } from '../model/finding.js';
import type { Project } from '../model/project.js';
import type { Rule } from '../model/rule.js';
import type { SourceFile } from '../model/source-file.js';
import { inContext } from '../support/in-context.js';
import { isDeclaredStyle } from '../support/is-declared-style.js';
import { pathInContext } from '../support/path-in-context.js';
import { perFile } from '../support/per-file.js';
import { roleDirectory } from '../support/role-directory.js';

const EXPORTED_CLASS = /(?<![\w$.])export\s+(?:default\s+)?(?:abstract\s+)?class\s+([\w$]+)/g;

export const namingOneConceptPerFile: Rule = {
  id: 'naming/one-concept-per-file',
  description:
    'One exported aggregate, entity, value object, event, handler or job per file, and one declared class per role file.',
  scope: 'file',
  run(project) {
    return perFile(project, this.id, (file) => {
      if (!inContext(file.location) || file.isTest) {
        return [];
      }

      const exported = severalExportedClasses(file);

      return exported.length > 0 ? exported : severalDeclaredClasses(file, project);
    });
  },
};

function severalExportedClasses(file: SourceFile): Finding[] {
  if (!inContext(file.location) || roleOf(roleDirectory(file.location))?.oneConcept !== true) {
    return [];
  }

  const classes = [...file.scan.code.matchAll(EXPORTED_CLASS)];
  const [first, second] = classes;

  if (first === undefined || second === undefined) {
    return [];
  }

  return [
    {
      line: file.scan.lineAt(second.index),
      message: `The file exports ${classes.length} classes (${classes.map((match) => match[1]).join(', ')}).`,
      fix: `Keep ${first[1] ?? 'the first class'} here and move each other class to its own file named after it.`,
    },
  ];
}

/** In the declared style a role file is found by its name and read for one class: a second declared class hides behind the first. */
function severalDeclaredClasses(file: SourceFile, project: Project): Finding[] {
  if (!isDeclaredStyle(project) || declaredRoleOf(pathInContext(project, file) ?? '') === undefined) {
    return [];
  }

  const declared = classesOf(file.scan).filter(({ decorations }) => decorations.length > 0);
  const [first, second] = declared;

  if (first === undefined || second === undefined) {
    return [];
  }

  return [
    {
      line: second.line,
      message: `The file declares ${declared.length} classes (${declared.map(({ name }) => name).join(', ')}).`,
      fix: `Keep ${first.name} here and move each other declared class to its own role file named after it, so that each one is found by the name of its file.`,
    },
  ];
}
