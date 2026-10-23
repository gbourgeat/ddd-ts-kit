import type { AuditEntriesParameters } from '{{alias.platform}}/audit/search-audit-entries/audit-entries-parameters{{alias.ext}}';
import { auditOutcomes } from '{{alias.platform}}/audit/search-audit-entries/audit-outcomes{{alias.ext}}';
import type { AuditEntriesFilter } from '{{alias.platform}}/audit/search-audit-entries/search-audit-entries.query{{alias.ext}}';

/** The filter of the query, from the parameters a reader wrote: a blank one narrows nothing. */
export function auditEntriesFilterOf(parameters: AuditEntriesParameters): AuditEntriesFilter {
  const outcome = auditOutcomes.find((candidate) => candidate === parameters['outcome']);

  return {
    ...textOf(parameters, 'actorId'),
    ...textOf(parameters, 'action'),
    ...textOf(parameters, 'correlationId'),
    ...(outcome === undefined ? {} : { outcome }),
  };
}

function textOf<Key extends string>(parameters: AuditEntriesParameters, key: Key): Partial<Record<Key, string>> {
  const value = parameters[key];
  const found: Partial<Record<Key, string>> = {};

  if (typeof value === 'string' && value !== '') {
    found[key] = value;
  }

  return found;
}
