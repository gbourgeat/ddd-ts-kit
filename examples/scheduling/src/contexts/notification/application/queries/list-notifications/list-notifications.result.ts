import type { Page } from '@ddd-ts-kit/kernel';

export interface ListNotificationsItem {
  readonly id: string;
  readonly recipientId: string;
  readonly kind: string;
  readonly appointmentId: string;
  /** The start of the appointment the notification told about. */
  readonly startsAt: Date;
  readonly sentAt: Date;
}

/** Latest first unless the client asks otherwise. */
export type ListNotificationsSort = 'sentAt';

export type ListNotificationsResult = Page<ListNotificationsItem>;
