import { defineContextModule, type ContextModule } from '@ddd-ts-kit/di';
import { CheckpointStore, EventStore, PersonalDataCipher, SnapshotStore, SubjectKeyStore } from '@ddd-ts-kit/kernel';
import type { EventSourcing } from '{{alias.platform}}/event-sourcing/create-event-sourcing{{alias.ext}}';

/**
 * The event store as a capability of the platform, not a bounded context: the stores an
 * event-sourced repository adapter names in its constructor (`EventStore`, `SnapshotStore`,
 * `CheckpointStore`), the keys of the data subjects{{#if audit.on}}, audited,{{/if}} and the cipher that seals a personal
 * value of a stored event (`PersonalDataCipher`).
 */
export function eventSourcingModule(eventSourcing: EventSourcing): ContextModule {
  return defineContextModule({
    name: 'event-sourcing',
    register(builder) {
      builder.bind(EventStore).toValue(eventSourcing.events);
      builder.bind(SnapshotStore).toValue(eventSourcing.snapshots);
      builder.bind(CheckpointStore).toValue(eventSourcing.checkpoints);
      builder.bind(SubjectKeyStore).toValue(eventSourcing.subjectKeys);
      builder.bind(PersonalDataCipher).toValue(eventSourcing.cipher);
    },
  });
}
