import type { Name } from '../../naming';
import type { RenderContext } from '../../templating';
import type { Scope } from '../scope';
import { birthSpan } from './birth-span';

/**
 * What the trace of a request says when its use case is a command, as far as its handler shows
 * it today: the span of the command and, when the handler saves through a repository, the span
 * of that save, followed by the birth event of the aggregate it creates. A query gets no trace assertion.
 */
export function tracedCommand(scope: Scope, name: Name): RenderContext & { readonly saved: string } {
  const handler = scope.ws.read(`${scope.dir}/application/commands/${name.kebab}/${name.kebab}.handler.ts`);

  if (handler === undefined) {
    return { traced: false, saved: '' };
  }

  const repository = /\.save\(/.test(handler)
    ? /private readonly \w+: (\w+Repository)\b/.exec(handler)?.[1]
    : undefined;

  return {
    traced: true,
    saved:
      repository === undefined
        ? ''
        : `, children: [{ name: 'repository ${repository}.save' }${birthSpan(scope, handler)}]`,
  };
}
