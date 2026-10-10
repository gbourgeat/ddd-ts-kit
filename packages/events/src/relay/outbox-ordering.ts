/**
 * `none`: records go out in store order and a failed one is overtaken by its successors.
 * `per-key`: a record is never published while an earlier record with the same key is still
 * pending or failed, at the price of head-of-line blocking on that key.
 */
export type OutboxOrdering = 'none' | 'per-key';
