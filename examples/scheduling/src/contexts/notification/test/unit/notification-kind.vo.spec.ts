import { describe, expect, it } from 'vitest';
import { expectRefusal } from '@ddd-ts-kit/testing';
import { NotificationKind } from '@/contexts/notification/domain/value-objects/notification-kind.vo';

describe('NotificationKind', () => {
  it('is equal to another notification kind with the same value', () => {
    const first = NotificationKind.create('reminder');
    const second = NotificationKind.create('reminder');

    expect(first.equals(second)).toBe(true);
  });

  it('refuses an empty value with a coded error', () => {
    expect(() => NotificationKind.create('  ')).toThrow();
  });

  it.each(['request', 'confirmation', 'rescheduling', 'cancellation', 'reminder'])('accepts the kind %s', (kind) => {
    expect(NotificationKind.create(kind).value).toBe(kind);
  });

  it('refuses a kind the business does not know, with the code INVALID_NOTIFICATION_KIND', () => {
    expectRefusal(() => NotificationKind.create('newsletter'), 'INVALID_NOTIFICATION_KIND', { given: 'newsletter' });
  });

  it('reads a kind whatever its case and the spaces around it', () => {
    const normalized = NotificationKind.create('  Confirmation ');

    expect(normalized.equals(NotificationKind.create('confirmation'))).toBe(true);
  });

  it.each(['request', 'confirmation', 'rescheduling'])('tells of an appointment to come when it is a %s', (kind) => {
    const subject = NotificationKind.create(kind);

    expect(subject.announcesAnAppointmentToCome()).toBe(true);
    expect(subject.announcesTheEndOfAnAppointment()).toBe(false);
  });

  it('tells of the end of an appointment when it is a cancellation', () => {
    const subject = NotificationKind.create('cancellation');

    expect(subject.announcesTheEndOfAnAppointment()).toBe(true);
    expect(subject.announcesAnAppointmentToCome()).toBe(false);
  });

  it('tells neither of an appointment to come nor of its end when it is a reminder', () => {
    const subject = NotificationKind.create('reminder');

    expect(subject.announcesAnAppointmentToCome()).toBe(false);
    expect(subject.announcesTheEndOfAnAppointment()).toBe(false);
  });
});
