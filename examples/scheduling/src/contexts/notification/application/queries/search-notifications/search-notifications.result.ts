import type { Page } from '@ddd-ts-kit/kernel';

export interface SearchNotificationsItem {
  readonly id: string;
  readonly recipientId: string;
  readonly kind: string;
  readonly appointmentId: string;
  /** The start of the appointment the notification told about. */
  readonly startsAt: Date;
  readonly sentAt: Date;
}

/** Latest first unless the client asks otherwise. */
export type SearchNotificationsSort = 'sentAt';

export type SearchNotificationsResult = Page<SearchNotificationsItem>;
