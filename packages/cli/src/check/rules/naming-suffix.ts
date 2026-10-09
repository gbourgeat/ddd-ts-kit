import path from 'node:path';
import { roleOf } from '../canonical.js';
import type { Rule } from '../types.js';
import { inContext, KEBAB_SEGMENT, reporter, type ContextLocation, type Finding } from './helpers.js';

export const namingSuffix: Rule = {
  id: 'naming/suffix',
  description: "A file in a role directory carries the role's suffix, in kebab-case.",
  scope: 'file',
  run(project) {
    const report = reporter(project, this.id);
    return project.files.flatMap((file) => {
      if (!inContext(file.location) || file.location.layer === 'module') return [];
      const name = path.posix.basename(file.path);
      if (name === 'index.ts') return [];
      const finding = notKebab(name) ?? withoutSuffix(name, file.location);
      return finding === undefined ? [] : [report({ file: file.path, line: 1 }, finding.message, finding.fix)];
    });
  },
};

type Misnamed = Omit<Finding, 'line'>;

function notKebab(name: string): Misnamed | undefined {
  if (name.split('.').every((segment) => KEBAB_SEGMENT.test(segment))) return undefined;
  return { message: `"${name}" is not in kebab-case.`, fix: 'Rename the file in lower-case words separated by hyphens, for example invoice-line.entity.ts.' };
}

function withoutSuffix(name: string, { layer, inside }: ContextLocation): Misnamed | undefined {
  if (layer === 'root') return undefined;
  const directory = [layer, ...inside.slice(0, -1)].join('/');
  const role = roleOf(directory);
  if (role === undefined || role.suffixes.length === 0) return undefined;
  if (role.suffixes.some((suffix) => name.endsWith(suffix) && name.length > suffix.length)) return undefined;
  return {
    message: `"${name}" sits in ${directory}/ without the suffix of that role.`,
    fix: `Rename it to end with ${role.suffixes.join(' or ')}, or move it to the directory matching what it is.`,
  };
}
