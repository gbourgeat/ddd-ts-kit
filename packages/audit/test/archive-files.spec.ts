import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { AuditArchiveRefusedError, archiveKeyOf, verifyArchive } from '../src';

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
  it('says where the chain breaks when the verification found the place, and that nothing was archived either way', () => {
    expect(new AuditArchiveRefusedError('tenant:acme', undefined).message).toBe(
      'The entries of tenant:acme to archive do not verify: nothing was archived',
    );

    expect(
      new AuditArchiveRefusedError('tenant:acme', {
        kind: 'altered-content',
        chain: 'tenant:acme',
        position: 2,
        sequence: 3,
        entryId: 'entry-3',
      }).message,
    ).toBe('The entries of tenant:acme to archive do not verify (altered-content at sequence 3): nothing was archived');
  });
});
