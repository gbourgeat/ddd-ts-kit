import type { AuditReader, AuditTrail } from '@ddd-ts-kit/kernel';

export interface AuditTrailUnderContract extends AuditTrail, AuditReader {}
