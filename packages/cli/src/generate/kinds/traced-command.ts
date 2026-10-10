import type { Name } from '../../naming/index.js';
import type { RenderContext } from '../../templating/index.js';
import type { Scope } from '../scope.js';

/**
 * What the trace of a request says when its use case is a command, as far as its handler shows
 * it today: the span of the command and, when the handler saves through a repository, the span
 * of that save. A query gets no trace assertion.
 */
export function tracedCommand(scope: Scope, name: Name): RenderContext {
  const handler = scope.ws.read(`${scope.dir}/application/commands/${name.kebab}/${name.kebab}.handler.ts`);

  if (handler === undefined) return { traced: false, saved: '' };

  const repository = /\.save\(/.test(handler) ? /private readonly \w+: (\w+Repository)\b/.exec(handler)?.[1] : undefined;

  return { traced: true, saved: repository === undefined ? '' : `, children: [{ name: 'repository ${repository}.save' }]` };
}
