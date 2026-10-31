import { specifierOf } from '../alias';
import type { Scope } from '../generate/scope';
import { withImport } from '../generate/with-import';
import { renderTemplate, type RenderContext } from '../templating';

const COMMANDS = 'commands: auditMiddleware(trail, { ...source, unitOfWork, onLostRecord })';

const COMMANDS_IN_THE_ORGANISATION =
  'commands: auditMiddleware(trail, { ...source, unitOfWork, onLostRecord, tenantOf: organisationOfCommand })';

/**
 * With tenants and an audit trail, the entry of a command that succeeded on an organisation is
 * written in the chain of that organisation: `organisationOfCommand`, next to `create-audit.ts`,
 * names it, and the audit middleware of the commands is given it as `tenantOf`. A `create-audit.ts`
 * the team rewrote is left as it is, with what to add.
 */
export function organisationsAsAuditChains(scope: Scope, rendering: RenderContext): void {
  const createAudit = `${scope.config.platformDir}/audit/create-audit.ts`;
  const current = scope.ws.read(createAudit);

  if (scope.config.stack.tenancy === 'none' || current === undefined) {
    return;
  }

  const file = `${scope.config.platformDir}/audit/organisation-of-command.ts`;

  // Written once: `init --force` rewires `create-audit.ts` and keeps what the team made of this file.
  if (!scope.ws.exists(file)) {
    scope.ws.create(file, renderTemplate('presets/identity/platform/organisation-of-command.ts.tpl', rendering));
  }

  if (!current.includes(COMMANDS)) {
    scope.ws.note(
      `${createAudit} no longer builds the audit of the commands as init wrote it: give \`auditMiddleware\` \`tenantOf: organisationOfCommand\` (${file}), so that a command on an organisation is audited in its chain.`,
    );

    return;
  }

  const importLine = `import { organisationOfCommand } from '${specifierOf(scope.config, file)}';`;

  scope.ws.update(createAudit, withImport(current.replaceAll(COMMANDS, COMMANDS_IN_THE_ORGANISATION), importLine));
}
