import type { AuditRecord } from '@ddd-ts-kit/kernel';
import type { AuditFact } from './audit-fact.js';
import type { AuditSource } from './audit-source.js';
import { recordIn } from './record-in.js';

/**
 * The record of a fact that happened in the work in progress. Sources use it, and so does
 * infrastructure writing a `data-access` entry by hand. Throws `NoExecutionContextError`
 * outside of `ExecutionScope.run`.
 */
export function auditRecordOf(source: AuditSource, fact: AuditFact): AuditRecord {
  return recordIn(source.scope.require(), source, fact);
}
