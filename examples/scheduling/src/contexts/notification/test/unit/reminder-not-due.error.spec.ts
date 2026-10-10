import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { ReminderNotDueError } from '../../domain/errors/reminder-not-due.error.js';

describe('ReminderNotDueError', () => {
  it('carries its stable code', () => {
    const error = new ReminderNotDueError('reminder-1');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('REMINDER_NOT_DUE');
  });
});
