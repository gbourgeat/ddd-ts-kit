import { ADR_DIRECTORY } from '../check/governance/adr-directory.js';
import { nextAdrNumber } from '../generate/kinds/next-adr-number.js';
import type { Scope } from '../generate/scope.js';
import { vars } from '../generate/vars.js';
import { renderTemplate } from '../templating/index.js';

/**
 * The decision record a preset writes when the project has tenants: why the tables of its context
 * belong to no tenant, which the suppressions of its adapters name. Answers its reference
 * (`ADR-0003`), or nothing for a project of one customer.
 */
export function presetDecision(scope: Scope, preset: string): string {
  if (scope.config.stack.tenancy === 'none') {
    return '';
  }

  const number = nextAdrNumber(scope.ws);
  const adr = { number, date: new Date().toISOString().slice(0, 10) };

  scope.ws.create(
    `${ADR_DIRECTORY}/${number}-${scope.context.kebab}-is-the-control-plane-of-the-tenants.md`,
    renderTemplate(`presets/${preset}/decision.md.tpl`, vars(scope, { adr })),
  );

  return `ADR-${number}`;
}
