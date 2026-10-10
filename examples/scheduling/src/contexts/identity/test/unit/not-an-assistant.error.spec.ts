import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { NotAnAssistantError } from '../../domain/errors/not-an-assistant.error.js';

describe('NotAnAssistantError', () => {
  it('carries its stable code', () => {
    const error = new NotAnAssistantError('person-1');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('NOT_AN_ASSISTANT');
  });
});
