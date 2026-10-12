import { describe, expect, it } from 'vitest';
import { unwrap } from '@ddd-ts-kit/kernel';
import { AttachedDocument } from '@/contexts/scheduling/domain/value-objects/attached-document.vo';

const FILE = {
  key: 'appointment-documents/2026/03/doc-1',
  size: 14,
  mediaType: 'application/pdf',
  checksum: 'sha256:00',
};

const AT = new Date('2026-03-02T09:00:00.000Z');

describe('AttachedDocument', () => {
  it('keeps the reference of the stored file and the name it was sent under, trimmed', () => {
    const document = unwrap(AttachedDocument.create(FILE, '  referral.pdf ', AT));

    expect([document.file, document.name, document.attachedAt]).toEqual([FILE, 'referral.pdf', AT]);
  });

  it('calls a document sent without a name "document"', () => {
    expect(unwrap(AttachedDocument.create(FILE, '   ', AT)).name).toBe('document');
  });

  it('refuses a name longer than two hundred characters', () => {
    expect(AttachedDocument.create(FILE, 'a'.repeat(201), AT)).toMatchObject({
      ok: false,
      error: { code: 'DOCUMENT_NAME_TOO_LONG' },
    });

    expect(AttachedDocument.create(FILE, 'a'.repeat(200), AT).ok).toBe(true);
  });

  it('is equal to another document of the same file, name and instant', () => {
    const first = unwrap(AttachedDocument.create(FILE, 'referral.pdf', AT));

    expect(first.equals(unwrap(AttachedDocument.create(FILE, 'referral.pdf', AT)))).toBe(true);
    expect(first.equals(unwrap(AttachedDocument.create(FILE, 'report.pdf', AT)))).toBe(false);
  });
});
