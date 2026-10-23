import type { AuditRecord } from '@ddd-ts-kit/kernel';
import { NOW } from './later';

export function aRecord(id: string): AuditRecord {
  return {
    id,
    occurredAt: NOW,
    category: 'command',
    action: 'ContractThingCommand',
    outcome: 'succeeded',
    actor: { id: 'ada', type: 'user' },
    correlationId: 'correlation-1',
    origin: 'http',
  };
}
