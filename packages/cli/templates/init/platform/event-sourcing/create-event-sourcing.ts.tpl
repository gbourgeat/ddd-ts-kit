{{#if audit.on}}
import { auditedSubjectKeys, type AuditSource } from '@ddd-ts-kit/audit';
{{/if}}
import { PersonalDataCipher, type EventSourcingStores } from '@ddd-ts-kit/kernel';
{{#if audit.on}}
import type { Audit } from '{{alias.platform}}/audit/create-audit{{alias.ext}}';
{{/if}}
import type { Persistence } from '{{alias.platform}}/database/persistence{{alias.ext}}';

/**
 * The event store as the platform hands it on: the stores an event-sourced repository adapter is
 * given (the events, the snapshots, the checkpoints of the projections the store feeds), the keys
 * of the data subjects and the cipher that seals a personal value of a stored event with the key
 * of its subject. An erasure destroys the key{{#if audit.on}}, and every erasure leaves a dated entry in the audit
 * trail, whoever asks for it{{/if}}. The keys live in the `subject_keys` table of the event store: a
 * deployment that promises erasure keeps them in a store of their own, with a shorter backup
 * retention than the events (docs/concepts/event-sourcing.md of ddd-ts-kit, "Personal data").
 */
export interface EventSourcing extends EventSourcingStores {
  readonly cipher: PersonalDataCipher;
}

{{#if audit.on}}
export function createEventSourcing(persistence: Persistence, audit: Audit, source: AuditSource): EventSourcing {
  const subjectKeys = auditedSubjectKeys(persistence.eventSourcing.subjectKeys, audit.trail, source);

  return { ...persistence.eventSourcing, subjectKeys, cipher: new PersonalDataCipher(subjectKeys) };
}
{{/if}}
{{#unless audit.on}}
export function createEventSourcing(persistence: Persistence): EventSourcing {
  const { subjectKeys } = persistence.eventSourcing;

  return { ...persistence.eventSourcing, cipher: new PersonalDataCipher(subjectKeys) };
}
{{/unless}}
