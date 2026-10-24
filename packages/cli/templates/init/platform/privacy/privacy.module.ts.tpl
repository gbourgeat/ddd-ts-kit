import { defineContextModule, type ContextModule } from '@ddd-ts-kit/di';
import { CheckpointStore, EventStore, PersonalDataCipher, SnapshotStore, SubjectKeyStore } from '@ddd-ts-kit/kernel';
import type { Persistence } from '{{alias.platform}}/database/persistence{{alias.ext}}';
import type { Privacy } from '{{alias.platform}}/privacy/create-privacy{{alias.ext}}';

/**
 * The event store and the personal data as a capability of the platform, not a bounded context:
 * the stores an event-sourced repository adapter is given (`EventStore`, `SnapshotStore`,
 * `CheckpointStore`), the keys of the data subjects{{#if audit.on}}, audited,{{/if}} and the cipher that seals a personal
 * value of a stored event (`PersonalDataCipher`).
 */
export function privacyModule(persistence: Persistence, privacy: Privacy): ContextModule {
  return defineContextModule({
    name: 'privacy',
    register(builder) {
      const { events, snapshots, checkpoints } = persistence.eventSourcing;

      builder.bind(EventStore).toValue(events);
      builder.bind(SnapshotStore).toValue(snapshots);
      builder.bind(CheckpointStore).toValue(checkpoints);
      builder.bind(SubjectKeyStore).toValue(privacy.subjectKeys);
      builder.bind(PersonalDataCipher).toValue(privacy.cipher);
    },
  });
}
