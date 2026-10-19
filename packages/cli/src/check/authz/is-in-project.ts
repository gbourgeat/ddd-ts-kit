import type { Project } from '../model/project.js';

/** The project holds a file at this path, from its root. */
export function isInProject(project: Project, path: string): boolean {
  return project.files.some((file) => file.path === path);
}
