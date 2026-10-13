import { toName } from '../naming/index.js';
import type { Workspace } from '../workspace/index.js';
import type { ProcessFacts } from './process-facts.js';

const FOLDER = 'application/processes';
const SUFFIX = '.process.ts';

/** The process managers of a context: one per `application/processes/*.process.ts`, named by its static `processName`. */
export function readProcesses(ws: Workspace, directory: string): ProcessFacts[] {
  return ws
    .list(`${directory}/${FOLDER}`)
    .filter((file) => file.endsWith(SUFFIX))
    .map((file) => {
      const className = `${toName(file.slice(0, -SUFFIX.length)).pascal}Process`;
      const source = ws.read(`${directory}/${FOLDER}/${file}`) ?? '';

      return {
        name: staticText(source, 'processName') ?? className,
        className,
        timeoutJob: staticText(source, 'timeoutJob') ?? '',
      };
    });
}

function staticText(source: string, member: string): string | undefined {
  return new RegExp(String.raw`\bstatic\s+(?:readonly\s+)?${member}\s*(?::\s*[^=]+)?=\s*'([^']+)'`).exec(source)?.[1];
}
