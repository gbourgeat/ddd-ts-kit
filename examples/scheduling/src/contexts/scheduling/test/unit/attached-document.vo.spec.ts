import { describe, expect, it } from 'vitest';
import { AttachedDocument } from '@/contexts/scheduling/domain/calendars/value-objects/attached-document.vo';
import { expectRefusal } from '@ddd-ts-kit/testing';

const FILE = {
  key: 'appointment-documents/2026/03/doc-1',
  size: 14,
  mediaType: 'application/pdf',
  checksum: 'sha256:00',
};

const AT = new Date('2026-03-02T09:00:00.000Z');

describe('AttachedDocument', () => {
  it('keeps the reference of the stored file and the name it was sent under, trimmed', () => {
    const document = AttachedDocument.create(FILE, '  referral.pdf ', AT);

    expect([document.file, document.name, document.attachedAt]).toEqual([FILE, 'referral.pdf', AT]);
  });

  it('calls a document sent without a name "document"', () => {
    expect(AttachedDocument.create(FILE, '   ', AT).name).toBe('document');
  });

  it('refuses a name longer than two hundred characters', () => {
    expectRefusal(() => AttachedDocument.create(FILE, 'a'.repeat(201), AT), 'DOCUMENT_NAME_TOO_LONG');

    expect(() => AttachedDocument.create(FILE, 'a'.repeat(200), AT)).not.toThrow();
  });

  it('is equal to another document of the same file, name and instant', () => {
    const first = AttachedDocument.create(FILE, 'referral.pdf', AT);

    expect(first.equals(AttachedDocument.create(FILE, 'referral.pdf', AT))).toBe(true);
    expect(first.equals(AttachedDocument.create(FILE, 'report.pdf', AT))).toBe(false);
  });
});
