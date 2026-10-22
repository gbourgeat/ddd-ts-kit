import { DeclarationError } from '@ddd-ts-kit/kernel/declarations';
import type { Route } from '../route/route';
import type { Representations } from './representations';

/**
 * Refuses, when the routes are mounted, what the platform cannot serve: a media type no
 * representation provides, a body one cannot write or read, and any `produces` or `consumes`
 * when no representations are mounted, since the server would then answer JSON only while the
 * route and its contract promise more.
 */
export function assertServed(routes: readonly Route[], representations: Representations | undefined): void {
  if (representations !== undefined) {
    representations.assertServes(routes);

    return;
  }

  const declaring = routes.find(({ produces, consumes }) => [...(produces ?? []), ...(consumes ?? [])].length > 0);

  if (declaring !== undefined) {
    throw new DeclarationError(
      `Route "${declaring.operationId}" declares produces or consumes, and no representations are mounted: pass \`representations\` (Representations.standard()) in the mount options.`,
    );
  }
}
