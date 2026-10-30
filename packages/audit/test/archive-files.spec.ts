import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { AuditArchiveRefusedError, archiveKeyOf, verifyArchive, type ChainBreak } from '../src';

describe('the file of an archive', () => {
  it('is kept under the chain, one folder per segment, the range in its name', () => {
    expect(archiveKeyOf('tenant:acme', 1, 420)).toBe('audit-archives/tenant/acme/000000000001-000000000420.ndjson');
  });

  it('refuses a chain that makes no file key', () => {
    expect(() => archiveKeyOf('tenant:../acme', 1, 2)).toThrow(TypeError);
  });

  it('reports a line that is not an entry as a break of the chain', () => {
    const text = '42\n';
    const digest = createHash('sha256').update(text, 'utf8').digest('hex');

    expect(
      verifyArchive(text, {
        chain: 'tenant:acme',
        fromSequence: 1,
        toSequence: 1,
        lastHash: 'h',
        entries: 1,
        fileKey: 'k',
        fileDigest: digest,
        archivedAt: new Date(),
      }),
    ).toEqual({ valid: false, reason: 'chain', sequence: 1 });
  });
});

describe('a refused archive', () => {
  const brokenAt = (chain: string, sequence: number): ChainBreak => ({
    kind: 'altered-content',
    chain,
    position: sequence - 1,
    sequence,
    entryId: `entry-${sequence}`,
  });

  it('says where each chain breaks, and that its entries stay', () => {
    const refused = new AuditArchiveRefusedError([
      { chain: 'tenant:acme', chainBreak: brokenAt('tenant:acme', 3) },
      { chain: 'global', chainBreak: { kind: 'missing-entry', chain: 'global', position: 6, sequence: 7 } },
    ]);

    expect(refused.message).toBe(
      'The entries to archive do not verify and stay in the trail: tenant:acme (altered-content at sequence 3), global (missing-entry at sequence 7)',
    );

    expect(refused.code).toBe('AUDIT_ARCHIVE_REFUSED');
    expect(refused.archives).toEqual([]);
  });
});
