import { describe, expect, it } from 'vitest';
import { unwrap } from '@ddd-ts-kit/kernel';
import { NotificationKind } from '@/contexts/notification/domain/value-objects/notification-kind.vo.js';

describe('NotificationKind', () => {
  it('is equal to another notification kind with the same value', () => {
    const first = unwrap(NotificationKind.create('reminder'));
    const second = unwrap(NotificationKind.create('reminder'));

    expect(first.equals(second)).toBe(true);
  });

  it('refuses an empty value with a coded error', () => {
    const result = NotificationKind.create('  ');

    expect(result.ok).toBe(false);
  });

  it.each(['request', 'confirmation', 'rescheduling', 'cancellation', 'reminder'])('accepts the kind %s', (kind) => {
    expect(unwrap(NotificationKind.create(kind)).value).toBe(kind);
  });

  it('refuses a kind the business does not know, with the code INVALID_NOTIFICATION_KIND', () => {
    const result = NotificationKind.create('newsletter');

    expect(result).toMatchObject({ ok: false, error: { code: 'INVALID_NOTIFICATION_KIND', given: 'newsletter' } });
  });

  it('reads a kind whatever its case and the spaces around it', () => {
    const normalized = unwrap(NotificationKind.create('  Confirmation '));

    expect(normalized.equals(unwrap(NotificationKind.create('confirmation')))).toBe(true);
  });

  it.each(['request', 'confirmation', 'rescheduling'])('tells of an appointment to come when it is a %s', (kind) => {
    const subject = unwrap(NotificationKind.create(kind));

    expect(subject.announcesAnAppointmentToCome()).toBe(true);
    expect(subject.announcesTheEndOfAnAppointment()).toBe(false);
  });

  it('tells of the end of an appointment when it is a cancellation', () => {
    const subject = unwrap(NotificationKind.create('cancellation'));

    expect(subject.announcesTheEndOfAnAppointment()).toBe(true);
    expect(subject.announcesAnAppointmentToCome()).toBe(false);
  });

  it('tells neither of an appointment to come nor of its end when it is a reminder', () => {
    const subject = unwrap(NotificationKind.create('reminder'));

    expect(subject.announcesAnAppointmentToCome()).toBe(false);
    expect(subject.announcesTheEndOfAnAppointment()).toBe(false);
  });
});
