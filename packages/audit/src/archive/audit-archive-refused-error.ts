import type { ChainBreak } from '../verify/chain-break';

/** The entries to archive do not verify: they stay in the trail, and the break is for the operator to look at. */
export class AuditArchiveRefusedError extends Error {
  readonly code = 'AUDIT_ARCHIVE_REFUSED';

  constructor(
    readonly chain: string,
    readonly chainBreak: ChainBreak | undefined,
  ) {
    super(
      `The entries of ${chain} to archive do not verify${chainBreak === undefined ? '' : ` (${chainBreak.kind} at sequence ${String(chainBreak.sequence)})`}: nothing was archived`,
    );

    this.name = 'AuditArchiveRefusedError';
  }
}
