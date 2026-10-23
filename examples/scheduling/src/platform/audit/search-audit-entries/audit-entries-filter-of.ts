import type { AuditEntriesParameters } from '@/platform/audit/search-audit-entries/audit-entries-parameters';
import { auditOutcomes } from '@/platform/audit/search-audit-entries/audit-outcomes';
import type { AuditEntriesFilter } from '@/platform/audit/search-audit-entries/search-audit-entries.query';

/** The filter of the query, from the parameters a reader wrote: a blank one narrows nothing. */
export function auditEntriesFilterOf(parameters: AuditEntriesParameters): AuditEntriesFilter {
  const outcome = auditOutcomes.find((candidate) => candidate === parameters['outcome']);

  return {
    ...textOf(parameters, 'actorId'),
    ...textOf(parameters, 'action'),
    ...textOf(parameters, 'correlationId'),
    ...(outcome === undefined ? {} : { outcome }),
    ...networkOf(parameters),
  };
}

/** The network to read is a tenant: its id goes to the filter under that name. */
function networkOf(parameters: AuditEntriesParameters): Pick<AuditEntriesFilter, 'tenantId'> {
  const { network } = textOf(parameters, 'network');

  return network === undefined ? {} : { tenantId: network };
}

function textOf<Key extends string>(parameters: AuditEntriesParameters, key: Key): Partial<Record<Key, string>> {
  const value = parameters[key];
  const found: Partial<Record<Key, string>> = {};

  if (typeof value === 'string' && value !== '') {
    found[key] = value;
  }

  return found;
}
