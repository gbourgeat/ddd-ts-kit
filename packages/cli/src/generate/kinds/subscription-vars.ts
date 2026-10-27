import type { RenderContext } from '../../templating';
import type { Scope } from '../scope';

/**
 * How a hand-wired handler subscribes. In the process, the subscription deduplicates; behind a
 * broker, each context listens under its own name and the mark commits with the work of the handler.
 */
export function subscriptionVars(scope: Scope, isTyped: boolean): RenderContext {
  const external = scope.config.stack.broker !== 'none';

  return {
    declarative: isTyped && !external,
    transactional: isTyped && external,
    untyped: !isTyped,
    subscriber: external ? `platform.subscriberFor('${scope.context.kebab}')` : 'platform.subscriber',
  };
}
