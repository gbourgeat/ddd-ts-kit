import { permissionSets, type PermissionSet } from '../authz/permission-sets.js';
import type { Finding } from '../model/finding.js';
import type { Project } from '../model/project.js';
import type { Rule } from '../model/rule.js';
import type { SourceFile } from '../model/source-file.js';
import { reporter } from '../support/reporter.js';
import { toViolations } from '../support/to-violations.js';
import { escapeRegExp } from '../text/escape-reg-exp.js';

/**
 * In a project whose rights are roles, every permission a context declares is granted to a role
 * by name: by the entry of its set, by its id or by the wildcard of its context. The bare `'*'` of
 * the super-admin does not count: a permission only it reaches is a use case nobody else may run,
 * and nothing says whether that was meant. Silent when the rights are attributes, relationships or
 * an authorizer of the project's own, and when the platform holds no roles file.
 */
export const authzGranted: Rule = {
  id: 'authz/granted',
  description:
    'In a project whose rights are roles, every permission a context declares is granted to a role by name, not only through the super-admin wildcard.',
  scope: 'project',
  run(project) {
    const grants = rolesFile(project);

    if (project.config.stack.authz !== 'rbac' || grants === undefined) {
      return [];
    }

    const report = reporter(project, this.id);

    return project.files
      .filter((file) => !file.isTest && file.location.area === 'context')
      .flatMap((file) => toViolations(report, file.path, ungranted(file, grants)));
  },
};

function rolesFile(project: Project): SourceFile | undefined {
  const path = `${project.config.platformDir}/auth/roles.ts`;

  return project.files.find((file) => file.path === path);
}

function ungranted(file: SourceFile, grants: SourceFile): Finding[] {
  return permissionSets(file).flatMap((declared) =>
    declared.keys
      .filter(({ value }) => !isGranted(grants, declared, value))
      .map(({ value, line }) => ({
        line,
        message: `${declared.context}:${value} is granted to no role: only the super-admin wildcard '*' reaches it.`,
        fix: `Grant ${declared.set}['${value}'] to the roles that hold it in ${grants.path} (for example \`[Role.Member]: [${declared.set}['${value}']]\`), or generate the use case with --grant <role>. A permission meant for administrators only is granted to Role.Admin by name.`,
      })),
  );
}

/** By the entry of its set, `billingPermissions['invoice.issue']`; by its id, `'billing:invoice.issue'`; or by the wildcard of its context, `'billing:*'`. */
function isGranted(grants: SourceFile, { set, context }: PermissionSet, key: string): boolean {
  const { code, strings } = grants.scan;
  const ids = new Set([`${context}:${key}`, `${context}:*`]);
  const entries = [...code.matchAll(new RegExp(`(?<![\\w$.])${escapeRegExp(set)}\\s*\\[\\s*`, 'g'))];

  return (
    entries.some((entry) =>
      strings.some(({ start, value }) => start === entry.index + entry[0].length && value === key),
    ) || strings.some(({ value }) => ids.has(value))
  );
}
