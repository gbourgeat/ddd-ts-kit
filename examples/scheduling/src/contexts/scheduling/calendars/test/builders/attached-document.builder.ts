import { AttachedDocument } from '@/contexts/scheduling/calendars/domain/value-objects/attached-document.vo';

/** A referral attached on Monday 2 March 2026, its file stored under the key the test names. */
export function anAttachedDocument(key = 'appointment-documents/2026/03/document-1'): AttachedDocument {
  const file = { key, size: 15, mediaType: 'application/pdf', checksum: 'sha256:00' };

  return AttachedDocument.create(file, 'referral.pdf', new Date('2026-03-02T08:00:00.000Z'));
}
