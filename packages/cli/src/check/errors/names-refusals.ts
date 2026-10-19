import type { Project } from '../model/project.js';

/** True when the project writes one class per refusal, named after it, under `"stack.refusals": "named"`. */
export function namesRefusals(project: Project): boolean {
  return project.config.stack.refusals === 'named';
}
