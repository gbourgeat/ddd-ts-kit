import { isGranted } from '../authz/is-granted';
import { permissionSets } from '../authz/permission-sets';
import { signedInGrants } from '../authz/signed-in-grants';
import type { Finding } from '../model/finding';
import type { Project } from '../model/project';
import type { Rule } from '../model/rule';
import type { SourceFile } from '../model/source-file';
import { reporter } from '../support/reporter';
import { toViolations } from '../support/to-violations';
import { platformFileIn } from '../../platform-layout';
import { isInProject } from '../authz/is-in-project';

/**
 * In a project whose rights are roles, every permission a context declares is granted by name, to a
 * role or to every signed-in person: by the entry of its set, by its id or by the wildcard of its
 * context. The bare `'*'` of
 * the super-admin does not count: a permission only it reaches is a use case nobody else may run,
 * and nothing says whether that was meant. Silent when the rights are attributes, relationships or
 * an authorizer of the project's own, and when the platform holds no roles file.
 */
export const authzGranted: Rule = {
  id: 'authz/granted',
  description:
    'In a project whose rights are roles, every permission a context declares is granted by name to a role or to every signed-in person, not only through the super-admin wildcard.',
  scope: 'project',
  run(project) {
    const { roles, signedIn } = grantFiles(project);

    if (project.config.stack.authz !== 'rbac' || roles === undefined) {
      return [];
    }

    const grants = [roles, ...signedIn];

    const report = reporter(project, this.id);

    return project.files
      .filter((file) => !file.isTest && file.location.area === 'context')
      .flatMap((file) => toViolations(report, file.path, ungranted(file, grants)));
  },
};

/** The roles of the platform, and what every signed-in person holds when a context preset wrote it. */
function grantFiles(project: Project): { roles: SourceFile | undefined; signedIn: SourceFile[] } {
  const path = platformFileIn(project.config, 'auth/roles/roles.ts', (candidate) => isInProject(project, candidate));
  const roles = project.files.find((file) => file.path === path);
  const signedIn = signedInGrants(project);

  return { roles, signedIn: signedIn === undefined ? [] : [signedIn] };
}

function ungranted(file: SourceFile, grants: readonly SourceFile[]): Finding[] {
  return permissionSets(file).flatMap((declared) =>
    declared.keys
      .filter(({ value }) => !grants.some((grant) => isGranted(grant.scan, declared, value)))
      .map(({ value, line }) => ({
        line,
        message: `${declared.context}:${value} is granted to no role: only the super-admin wildcard '*' reaches it.`,
        fix: `Grant ${declared.set}['${value}'] to the roles that hold it in ${grants[0]?.path ?? 'the roles of the platform'} (for example \`[Role.Member]: [${declared.set}['${value}']]\`), or generate the use case with --grant <role>. A permission meant for administrators only is granted to Role.Admin by name.`,
      })),
  );
}
