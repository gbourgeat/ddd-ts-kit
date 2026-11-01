/**
 * A name that would become part of an index or an alias name and that the store refuses: a read
 * model name or a tenant outside lower case letters, digits and `_` (and `-` for a tenant), or too
 * long. Refused, never altered: `Acme` and `acme` would otherwise share one index.
 */
export class InvalidIndexNameError extends Error {
  readonly code = 'INVALID_INDEX_NAME';

  constructor(
    readonly what: 'read model' | 'tenant',
    readonly named: string,
    rule: string,
  ) {
    super(`Invalid ${what} name ${JSON.stringify(named.slice(0, 80))} for OpenSearch: ${rule}`);
    this.name = 'InvalidIndexNameError';
  }
}
