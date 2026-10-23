import type { ProjectionFact } from './context-description';
import type { ContextSources } from './context-sources';
import { roleFilesOf } from '../model-modules';

const FOLDER = 'application/projections';
const SUFFIX = '.projection.ts';

/** The projectors of a context, one per `*.projection.ts` file, with the events each one applies. */
export function readProjections(sources: ContextSources): ProjectionFact[] {
  const { ws } = sources;

  return roleFilesOf(ws, sources, FOLDER)
    .filter(({ name }) => name.endsWith(SUFFIX))
    .map(({ path }) => {
      const text = ws.read(path) ?? '';

      return {
        name: /@Projection\(\s*'([^']+)'/.exec(text)?.[1] ?? '',
        projector: /export class ([\w$]+)/.exec(text)?.[1] ?? '',
        applies: [...text.matchAll(/@On\(\s*([\w$.]+)/g)].map(([, event = '']) => event),
        file: path,
      };
    });
}
