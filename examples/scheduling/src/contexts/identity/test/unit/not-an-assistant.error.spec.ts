import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { NotAnAssistantError } from '@/contexts/identity/domain/errors/not-an-assistant.error';

describe('NotAnAssistantError', () => {
  it('carries its stable code', () => {
    const error = new NotAnAssistantError('person-1');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('NOT_AN_ASSISTANT');
  });
});
