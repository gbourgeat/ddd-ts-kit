import type { AuditReader } from '@ddd-ts-kit/kernel';
import type { ArchivableAuditTrail } from '../archive/archivable-audit-trail';
import type { ChainHead } from '../chain/chain-head';
import type { ChainBreak } from './chain-break';
import type { TrailVerification } from './trail-verification';
import { verifyChain, type VerifyChainOptions } from './verify-chain';

/**
 * Verifies every chain of the trail, each from its last archive to its head: the entries left in
 * the trail link to the anchor the last archive kept, and the chain reaches the sequence and the
 * hash its head says, so a chain cut at its tail does not verify. Each chain stops at its own
 * break and the others are verified all the same. The head is read before the entries: what is
 * appended meanwhile waits for the next verification. An anchor is what the archive row says;
 * `verifyArchive` proves the file it names.
 */
export async function verifyTrail(trail: AuditReader & ArchivableAuditTrail): Promise<TrailVerification> {
  const breaks: ChainBreak[] = [];
  let checked = 0;

  for (const head of await trail.chainHeads()) {
    const outcome = await verifyChain(trail, await fromTheLastArchive(trail, head));

    checked += outcome.checked;

    if (!outcome.valid) {
      breaks.push(outcome.break);
    }
  }

  return { valid: breaks.length === 0, checked, breaks };
}

async function fromTheLastArchive(trail: ArchivableAuditTrail, head: ChainHead): Promise<VerifyChainOptions> {
  const { chain, sequence } = head;
  const last = (await trail.archivesOf(chain)).at(-1);
  const range = { chain, to: sequence, checkpoints: [head] };

  return last === undefined ? range : { ...range, after: { chain, sequence: last.toSequence, hash: last.lastHash } };
}
