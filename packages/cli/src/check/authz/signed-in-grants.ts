import type { Project } from '../model/project';
import type { SourceFile } from '../model/source-file';
import { platformFileIn } from '../../platform-layout';
import { isInProject } from './is-in-project';

/** What every signed-in person holds, `<platformDir>/auth/authorization/signed-in-grants.ts`, when a context preset or the team wrote it. */
export function signedInGrants(project: Project): SourceFile | undefined {
  const file = platformFileIn(project.config, 'auth/authorization/signed-in-grants.ts', (path) =>
    isInProject(project, path),
  );

  return project.files.find((candidate) => candidate.path === file);
}
