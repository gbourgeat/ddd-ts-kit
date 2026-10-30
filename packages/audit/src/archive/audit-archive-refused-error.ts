import type { ChainBreak } from '../verify/chain-break';
import type { AuditArchive } from './audit-archive';

/** A chain whose entries to archive do not verify, and where. */
export interface AuditArchiveRefusal {
  readonly chain: string;
  readonly chainBreak: ChainBreak;
}

/**
 * Some entries to archive do not verify: they stay in the trail, and each break is for the
 * operator to look at. Thrown once every chain ran: `archives` holds what the others archived.
 */
export class AuditArchiveRefusedError extends Error {
  readonly code = 'AUDIT_ARCHIVE_REFUSED';

  constructor(
    readonly refusals: readonly AuditArchiveRefusal[],
    readonly archives: readonly AuditArchive[] = [],
  ) {
    super(`The entries to archive do not verify and stay in the trail: ${refusals.map(described).join(', ')}`);

    this.name = 'AuditArchiveRefusedError';
  }
}

function described({ chain, chainBreak }: AuditArchiveRefusal): string {
  return `${chain} (${chainBreak.kind} at sequence ${String(chainBreak.sequence)})`;
}
