/** The read model the criteria and read model contracts run on: one field of every type, two that may be null. */
export interface CriteriaContractRow {
  readonly id: string;
  readonly status: 'booked' | 'confirmed' | 'cancelled';
  readonly title: string;
  readonly seats: number;
  /** A decimal, as a string. */
  readonly price: string;
  readonly startsAt: Date;
  readonly cancelledAt: Date | null;
  readonly room: string | null;
  readonly remote: boolean;
  readonly tenantId: string;
}
