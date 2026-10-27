import { CONFIG_FILE, editConfigText, parseConfig, type Config } from '../config';
import type { Scope } from '../generate/scope';
import { isRecord } from '../config/values/is-record';

/**
 * Declares the context of a preset the control plane of the tenants, `contexts.<name>.tenancy`,
 * with the deviation that points to its decision record (`adr`, as `ADR-0001`): the generators then
 * confine none of its tables, and `tenancy/scoped-statement` leaves its adapters alone, so the
 * preset writes no suppression. Answers the config as it now stands.
 */
export function outsideTheTenancy(scope: Scope, adr: string): Config {
  const text = scope.ws.read(CONFIG_FILE);
  const name = scope.context.kebab;

  if (text === undefined) {
    return scope.config;
  }

  const deviation = {
    what: `contexts.${name}.tenancy`,
    adr: adr.replace(/^ADR-/, ''),
    reason: `The ${name} context is the control plane of the tenants: it decides who belongs to which, and its rows belong to none of them.`,
  };

  const edited = editConfigText(text, (raw) => {
    const contexts = isRecord(raw['contexts']) ? raw['contexts'] : {};
    const context = isRecord(contexts[name]) ? contexts[name] : {};
    const present: unknown[] = Array.isArray(raw['deviations']) ? raw['deviations'] : [];
    const recorded = present.some((entry) => isRecord(entry) && entry['what'] === deviation.what);

    raw['contexts'] = { ...contexts, [name]: { ...context, tenancy: 'control-plane' } };
    raw['deviations'] = recorded ? present : [...present, deviation];
  });

  scope.ws.update(CONFIG_FILE, edited);

  return parseConfig(JSON.parse(edited));
}
