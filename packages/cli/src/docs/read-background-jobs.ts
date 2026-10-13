import { toName } from '../naming/index.js';
import type { Workspace } from '../workspace/index.js';
import type { BackgroundJobFacts } from './background-job-facts.js';

const FOLDER = 'application/background';
const SUFFIX = '.background-job.ts';
const JOB_NAME = /\bstatic\s+(?:readonly\s+)?jobName\s*(?::\s*string\s*)?=\s*'([^']+)'/;

/** The background jobs of a context: one per `application/background/*.background-job.ts`, named by its static `jobName`. */
export function readBackgroundJobs(ws: Workspace, directory: string): BackgroundJobFacts[] {
  return ws
    .list(`${directory}/${FOLDER}`)
    .filter((file) => file.endsWith(SUFFIX))
    .map((file) => {
      const className = `${toName(file.slice(0, -SUFFIX.length)).pascal}Job`;
      const name = JOB_NAME.exec(ws.read(`${directory}/${FOLDER}/${file}`) ?? '')?.[1];

      return { name: name ?? className, className, file: `${directory}/${FOLDER}/${file}` };
    });
}
