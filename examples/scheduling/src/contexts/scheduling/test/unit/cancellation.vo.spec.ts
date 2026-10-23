import { describe, expect, it } from 'vitest';
import { Cancellation } from '@/contexts/scheduling/domain/calendars/value-objects/cancellation.vo';
import { expectRefusal } from '@ddd-ts-kit/testing';

describe('Cancellation', () => {
  it('is equal to another cancellation by the same side for the same reason', () => {
    const first = Cancellation.create('practice', 'The practitioner is away.');
    const second = Cancellation.create('practice', 'The practitioner is away.');

    expect(first.equals(second)).toBe(true);
  });

  it('lets a patient cancel without a word', () => {
    const cancellation = Cancellation.create('patient');

    expect(cancellation.by).toBe('patient');
    expect(cancellation.reason).toBeUndefined();
  });

  it('keeps the reason a patient gives', () => {
    const cancellation = Cancellation.create('patient', 'I feel better.');

    expect(cancellation.reason).toBe('I feel better.');
  });

  it.each([undefined, '', '   '])('refuses a cancellation by the practice whose reason is "%s"', (reason) => {
    expectRefusal(() => Cancellation.create('practice', reason), 'REASON_REQUIRED');
  });

  it('reads the same reason whatever the spaces around it', () => {
    const typed = Cancellation.create('practice', '  The practitioner is away. ');
    const clean = Cancellation.create('practice', 'The practitioner is away.');

    expect(typed.equals(clean)).toBe(true);
  });

  it('reads a reason made of spaces as no reason', () => {
    const silent = Cancellation.create('patient', '   ');

    expect(silent.equals(Cancellation.create('patient'))).toBe(true);
  });
});
