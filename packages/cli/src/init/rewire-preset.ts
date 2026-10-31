import type { Config } from '../config';
import { platformPath } from '../generate/platform-path';
import type { Scope } from '../generate/scope';
import { vars } from '../generate/vars';
import { parseContextName } from '../naming';
import { adapterOf } from '../presets/adapter-of';
import { wrapAuthorizer } from '../presets/wrap-authorizer';
import { NO_FLAGS } from '../presets/no-flags';
import { organisationsAsAuditChains } from '../presets/organisations-as-audit-chains';
import { organisationsAsTenantDirectory } from '../presets/organisations-as-tenant-directory';
import { organisationsAsTenants } from '../presets/organisations-as-tenants';
import { PRESETS } from '../presets/preset-named';
import type { Workspace } from '../workspace';

/**
 * What a preset changed in files of the platform that hold no region: the authorizer wrapped, the
 * organisations read as tenants and as the chains of the audit of their commands. A context written from a preset says so by a file only that
 * preset writes, and these are applied to the files just rewritten.
 */
export function rewirePreset(ws: Workspace, config: Config, name: string): void {
  const context = parseContextName(name);
  const dir = `${config.contextsDir}/${context.kebab}`;
  const preset = PRESETS.find(({ signature }) => ws.exists(`${dir}/${signature}`));
  const scope: Scope = { ws, config, context, dir, flags: NO_FLAGS };

  if (preset?.grantsEverySignedInPerson === true) {
    const grants = platformPath(scope, 'auth/authorization/signed-in-grants.ts');

    wrapAuthorizer(scope, platformPath(scope, 'auth/authorization/create-authorizer.ts'), grants);
  }

  if (preset?.organisationsAreTenants === true) {
    const rendering = vars(scope, { preset: { adapter: adapterOf(config) } });

    organisationsAsTenants(scope);
    organisationsAsTenantDirectory(scope, rendering);
    organisationsAsAuditChains(scope, rendering);
  }
}
