import type { Project } from '../model/project.js';
import type { SourceFile } from '../model/source-file.js';
import { platformFileIn } from '../../platform-layout/index.js';
import { isInProject } from './is-in-project.js';

/** What every signed-in person holds, `<platformDir>/auth/authorization/signed-in-grants.ts`, when a context preset or the team wrote it. */
export function signedInGrants(project: Project): SourceFile | undefined {
  const file = platformFileIn(project.config, 'auth/authorization/signed-in-grants.ts', (path) =>
    isInProject(project, path),
  );

  return project.files.find((candidate) => candidate.path === file);
}
