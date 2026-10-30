import type { ChainBreak } from './chain-break';

/** Some chains of the trail do not verify, each where it stops holding: for the operator to look at. */
export class AuditTrailBrokenError extends Error {
  readonly code = 'AUDIT_TRAIL_BROKEN';

  constructor(readonly breaks: readonly ChainBreak[]) {
    super(`The audit trail does not verify: ${breaks.map(described).join(', ')}`);

    this.name = 'AuditTrailBrokenError';
  }
}

function described({ chain, kind, sequence }: ChainBreak): string {
  return `${chain} (${kind} at sequence ${String(sequence)})`;
}
