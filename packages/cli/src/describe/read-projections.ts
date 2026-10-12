import type { ProjectionFact } from './context-description.js';
import type { ContextSources } from './context-sources.js';

const FOLDER = 'application/projections';
const SUFFIX = '.projection.ts';

/** The projectors of a context, one per `*.projection.ts` file, with the events each one applies. */
export function readProjections({ ws, directory }: ContextSources): ProjectionFact[] {
  return ws
    .list(`${directory}/${FOLDER}`)
    .filter((file) => file.endsWith(SUFFIX))
    .map((file) => {
      const path = `${directory}/${FOLDER}/${file}`;
      const text = ws.read(path) ?? '';

      return {
        name: /@Projection\(\s*'([^']+)'/.exec(text)?.[1] ?? '',
        projector: /export class ([\w$]+)/.exec(text)?.[1] ?? '',
        applies: [...text.matchAll(/@On\(\s*([\w$.]+)/g)].map(([, event = '']) => event),
        file: path,
      };
    });
}
