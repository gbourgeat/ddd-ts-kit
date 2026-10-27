import type { Project } from '../model/project';
import { platformFileIn } from '../../platform-layout';
import { isInProject } from './is-in-project';

/**
 * Whether the project decides rights with an authorizer of its own: the `createAuthorizer` of the
 * platform imports a class named `*Authorizer` from a file of the project. Such a class may grant
 * what the schema does not (a system actor its own context, a role of the token), which the
 * checker cannot read: the rules that judge the grants of the standard authorizer stay silent.
 */
export function ownAuthorizer(project: Project): boolean {
  const path = platformFileIn(project.config, 'auth/authorization/create-authorizer.ts', (candidate) =>
    isInProject(project, candidate),
  );

  return (
    project.files
      .find((file) => file.path === path)
      ?.imports.some(
        ({ target, names }) => target.kind === 'file' && names.some((name) => name.endsWith('Authorizer')),
      ) ?? false
  );
}
