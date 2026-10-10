/**
 * `occurredAt` orders by instant, then chain, then sequence: the order a person reads in.
 * `sequence` orders by chain, then sequence: the order a chain is verified in.
 */
export type AuditSortField = 'occurredAt' | 'sequence';
