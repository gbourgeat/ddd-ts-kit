import { FactualRefusal } from '../../domain/errors/factual-refusal';

/**
 * A tenant id outside the grammar of `isTenantId`: refused where it comes in, never altered. No such
 * tenant can exist, so the edge answers 404, and what was named stays in the message, which never
 * leaves the process.
 */
export class InvalidTenantIdError extends FactualRefusal {
  readonly code = 'NOT_FOUND';

  constructor(readonly tenantId: string) {
    const named = JSON.stringify(tenantId.slice(0, 80));

    super(`Invalid tenant id ${named}: only letters, digits, "_" and "-", at most 63`, { named });
  }
}
