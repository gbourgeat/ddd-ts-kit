import type { Project } from '../model/project.js';
import type { SourceFile } from '../model/source-file.js';

/** What every signed-in person holds, `<platformDir>/auth/signed-in-grants.ts`, when a context preset or the team wrote it. */
export function signedInGrants(project: Project): SourceFile | undefined {
  const file = `${project.config.platformDir}/auth/signed-in-grants.ts`;

  return project.files.find((candidate) => candidate.path === file);
}
