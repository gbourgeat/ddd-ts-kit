import { describe, expect, it } from 'vitest';
import { unwrap } from '@ddd-ts-kit/kernel';
import { Cancellation } from '#src/contexts/scheduling/domain/value-objects/cancellation.vo.js';

describe('Cancellation', () => {
  it('is equal to another cancellation by the same side for the same reason', () => {
    const first = unwrap(Cancellation.create('practice', 'The practitioner is away.'));
    const second = unwrap(Cancellation.create('practice', 'The practitioner is away.'));

    expect(first.equals(second)).toBe(true);
  });

  it('lets a patient cancel without a word', () => {
    const cancellation = unwrap(Cancellation.create('patient'));

    expect(cancellation.by).toBe('patient');
    expect(cancellation.reason).toBeUndefined();
  });

  it('keeps the reason a patient gives', () => {
    const cancellation = unwrap(Cancellation.create('patient', 'I feel better.'));

    expect(cancellation.reason).toBe('I feel better.');
  });

  it.each([undefined, '', '   '])('refuses a cancellation by the practice whose reason is "%s"', (reason) => {
    const result = Cancellation.create('practice', reason);

    expect(result).toMatchObject({ ok: false, error: { code: 'REASON_REQUIRED' } });
  });

  it('reads the same reason whatever the spaces around it', () => {
    const typed = unwrap(Cancellation.create('practice', '  The practitioner is away. '));
    const clean = unwrap(Cancellation.create('practice', 'The practitioner is away.'));

    expect(typed.equals(clean)).toBe(true);
  });

  it('reads a reason made of spaces as no reason', () => {
    const silent = unwrap(Cancellation.create('patient', '   '));

    expect(silent.equals(unwrap(Cancellation.create('patient')))).toBe(true);
  });
});
