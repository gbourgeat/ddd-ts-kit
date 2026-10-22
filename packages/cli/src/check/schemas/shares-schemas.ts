import type { Project } from '../model/project';

/** The `schema/*` rules judge a project that says it shares its schemas; one that does not say keeps one schema per route, as 0.5. */
export function sharesSchemas(project: Project): boolean {
  return project.config.stack.schemas === 'shared';
}
