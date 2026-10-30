import type { AuditRecord } from '@ddd-ts-kit/kernel';
import { fullRecord } from './full-record';

/** A record with `text` in every text it carries, the keys of what it holds included. */
export function textsOf(text: string): AuditRecord {
  const record = fullRecord(`entry-${text}`);

  return {
    ...record,
    action: `contract.${text}`,
    reason: text,
    actor: { id: text, type: 'user', tenantId: 'alpha' },
    impersonatedBy: text,
    sessionId: text,
    resource: { type: text, id: text },
    context: text,
    correlationId: text,
    causationId: text,
    changes: { [text]: text, nested: { masked: text } },
    extensions: { [text]: text, [`listed ${text}`]: [text] },
  };
}
