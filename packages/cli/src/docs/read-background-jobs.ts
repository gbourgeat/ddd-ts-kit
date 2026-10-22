import { toName } from '../naming';
import type { Workspace } from '../workspace';
import type { BackgroundJobFacts } from './background-job-facts';
import { type ContextTree, roleFilesOf } from '../model-modules';

const FOLDER = 'application/background';
const SUFFIX = '.background-job.ts';
const JOB_NAME = /\bstatic\s+(?:readonly\s+)?jobName\s*(?::\s*string\s*)?=\s*'([^']+)'/;

/** The background jobs of a context: one per `application/background/*.background-job.ts`, named by its static `jobName`. */
export function readBackgroundJobs(ws: Workspace, tree: ContextTree): BackgroundJobFacts[] {
  return roleFilesOf(ws, tree, FOLDER)
    .filter((file) => file.name.endsWith(SUFFIX))
    .map((file) => {
      const className = `${toName(file.name.slice(0, -SUFFIX.length)).pascal}BackgroundJob`;
      const name = JOB_NAME.exec(ws.read(file.path) ?? '')?.[1];

      return { name: name ?? className, className, file: file.path };
    });
}
