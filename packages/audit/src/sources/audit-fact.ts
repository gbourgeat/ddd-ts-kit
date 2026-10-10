import type { AuditEntry } from '@ddd-ts-kit/kernel';

/** What happened. Who, in which session and under which correlation come from the scope. */
export type AuditFact = Pick<AuditEntry, 'category' | 'action' | 'outcome'> &
  Partial<Pick<AuditEntry, 'reason' | 'resource' | 'context' | 'changes' | 'extensions'>>;
