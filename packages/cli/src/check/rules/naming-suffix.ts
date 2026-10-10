import path from 'node:path';
import { routesFile } from '../../declared/index.js';
import { roleOf } from '../canonical/role-of.js';
import type { ContextLocation } from '../model/context-location.js';
import type { Flaw } from '../model/flaw.js';
import type { Rule } from '../model/rule.js';
import { inContext } from '../support/in-context.js';
import { KEBAB_SEGMENT } from '../support/kebab-segment.js';
import { pathInContext } from '../support/path-in-context.js';
import { perFile } from '../support/per-file.js';
import { roleDirectory } from '../support/role-directory.js';

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

      if (name === 'index.ts') {
        return [];
      }

      // The routes of a context are one list named after it instead of a role, in either style.
      if (pathInContext(project, file) === routesFile(file.location.context)) {
        return [];
      }

      const flaw = notKebab(name) ?? withoutSuffix(name, file.location);

      return flaw === undefined ? [] : [{ line: 1, ...flaw }];
    });
  },
};

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

  if (role === undefined || role.suffixes.length === 0) {
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
