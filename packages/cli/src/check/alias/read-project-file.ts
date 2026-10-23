import fs from 'node:fs';
import path from 'node:path';
import type { Project } from '../model/project';

/** The text of a file of the project given from its root, or nothing when it is not there. */
export function readProjectFile(project: Pick<Project, 'root'>, file: string): string | undefined {
  try {
    return fs.readFileSync(path.join(project.root, file), 'utf8');
  } catch {
    return undefined;
  }
}
