import type { RenderContext } from '../../templating/index.js';
import { renderTemplate } from '../../templating/index.js';
import type { Scope } from '../scope.js';

/**
 * The helper an adapter states its own policy with joins the platform with the first adapter
 * that names it: a project without one would hold a file nothing imports, which its dead-code
 * gate reports. Wired by hand, the platform itself uses the helper, and `init` wrote it.
 */
export function writeOwnPolicy(scope: Scope, context: RenderContext): void {
  const file = `${scope.config.platformDir}/resilience/own-policy.ts`;

  if (!scope.ws.exists(file)) {
    scope.ws.create(file, renderTemplate('init/platform/resilience/own-policy.ts.tpl', context));
  }
}
