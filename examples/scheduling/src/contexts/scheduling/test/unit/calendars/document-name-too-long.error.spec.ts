import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { DocumentNameTooLong } from '@/contexts/scheduling/calendars/domain/errors/document-name-too-long.error';

describe('DocumentNameTooLong', () => {
  it('refuses the name of a document longer than allowed, and says how long it may be', () => {
    const error = DocumentNameTooLong.withMaximum(200);

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('DOCUMENT_NAME_TOO_LONG');
    expect(error.message).toBe('The name of a document holds at most 200 characters.');
    expect(error.exposedFacts).toEqual({ longest: 200 });
  });
});
