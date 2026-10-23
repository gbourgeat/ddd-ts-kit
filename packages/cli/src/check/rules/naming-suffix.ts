import path from 'node:path';
import { isDeclarationsFile, routesFile } from '../../declared';
import { roleOf } from '../canonical/role-of';
import type { ContextLocation } from '../model/context-location';
import type { Flaw } from '../model/flaw';
import type { Project } from '../model/project';
import type { Rule } from '../model/rule';
import type { SourceFile } from '../model/source-file';
import { inContext } from '../support/in-context';
import { isDeclaredStyle } from '../support/is-declared-style';
import { KEBAB_SEGMENT } from '../support/kebab-segment';
import { pathInContext } from '../support/path-in-context';
import { perFile } from '../support/per-file';
import { roleDirectory } from '../support/role-directory';
import { WITHOUT_MODULE } from '../../model-modules';

export const namingSuffix: Rule = {
  id: 'naming/suffix',
  description: "A file in a role directory carries the role's suffix, in kebab-case.",
  scope: 'file',
  run(project) {
    return perFile(project, this.id, (file) => {
      if (!inContext(file.location) || file.location.layer === 'module') {
        return [];
      }

      const name = path.posix.basename(file.path);

      if (name === 'index.ts' || namedByTheKit(project, file, file.location.context)) {
        return [];
      }

      // A file of the context at its root (its code list) is named as it would be in its role folder.
      const flaw = notKebab(name) ?? withoutSuffix(file.location.inside.at(-1) ?? name, file.location);

      return flaw === undefined ? [] : [{ line: 1, ...flaw }];
    });
  },
};

/**
 * The routes of a context are one list named after it instead of a role, in either style; the
 * generated declarations of a layer are named after the layer.
 */
function namedByTheKit(project: Project, file: SourceFile, context: string): boolean {
  const relative = pathInContext(project, file) ?? '';

  return (
    relative === routesFile(context) ||
    (isDeclaredStyle(project) && isDeclarationsFile(context, relative, WITHOUT_MODULE))
  );
}

function notKebab(name: string): Flaw | undefined {
  if (name.split('.').every((segment) => KEBAB_SEGMENT.test(segment))) {
    return undefined;
  }

  return {
    message: `"${name}" is not in kebab-case.`,
    fix: 'Rename the file in lower-case words separated by hyphens, for example invoice-line.entity.ts.',
  };
}

function withoutSuffix(name: string, location: ContextLocation): Flaw | undefined {
  if (location.layer === 'root') {
    return undefined;
  }

  const directory = roleDirectory(location);
  const role = roleOf(directory);

  if (role === undefined || role.suffixes.length === 0 || role.files?.includes(name) === true) {
    return undefined;
  }

  if (role.suffixes.some((suffix) => name.endsWith(suffix) && name.length > suffix.length)) {
    return undefined;
  }

  return {
    message: `"${name}" sits in ${directory}/ without the suffix of that role.`,
    fix: `Rename it to end with ${role.suffixes.join(' or ')}, or move it to the directory matching what it is.`,
  };
}
