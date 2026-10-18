import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { NotAnAssistant } from '@/contexts/identity/domain/errors/not-an-assistant.error';

describe('NotAnAssistant', () => {
  it('refuses with the code NOT_AN_ASSISTANT, its message and its facts', () => {
    const error = NotAnAssistant.forPerson('person-1');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('NOT_AN_ASSISTANT');
    expect(error.message).toBe('The person person-1 is not an assistant of this practice.');
    expect(error.facts).toEqual({ personId: 'person-1' });
    expect(error.exposedFacts).toEqual({});
  });
});
