import type { RenderContext } from '../../../templating';
import type { Scope } from '../../scope';

/** Says, once the spec is written, what the world of its context would change in it. */
export function noteWorldArrangement(scope: Scope, context: RenderContext): void {
  const world = context['world'];
  const hint = typeof world === 'object' ? world['hint'] : undefined;

  if (typeof hint === 'string' && hint !== '') {
    scope.ws.note(hint);
  }
}
