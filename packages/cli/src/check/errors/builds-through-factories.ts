import type { Project } from '../model/project.js';

/** The `errors/*` rules judge a project that says it builds its refusals through factories; one that does not say keeps the form of 0.2. */
export function buildsThroughFactories(project: Project): boolean {
  return project.config.stack.refusals === 'factories';
}
