import type { Project } from '../model/project';

/**
 * The `errors/*` rules judge a project that says it builds its refusals through factories, of a
 * class per concept (`factories`) or of a class per refusal (`named`); one that does not say keeps the form of 0.2.
 */
export function buildsThroughFactories(project: Project): boolean {
  const { refusals } = project.config.stack;

  return refusals === 'factories' || refusals === 'named';
}
