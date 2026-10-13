import { InMemoryRelationTupleStore, RelationTupleStore, SchemaCheckedTupleStore } from '@ddd-ts-kit/auth/rebac';
import { defineContextModule } from '@ddd-ts-kit/di';
import {
  CheckpointStore,
  EventStore,
  InMemoryCheckpointStore,
  InMemoryEventStore,
  InMemorySnapshotStore,
  InMemorySubjectKeyStore,
  PersonalDataCipher,
  SnapshotStore,
  SubjectKeyStore,
} from '@ddd-ts-kit/kernel';
import { InMemoryFileStorage } from '@ddd-ts-kit/kernel';
import { KnexContext } from '@ddd-ts-kit/knex';
import { relationshipSchema } from '@/platform/auth/relationship-schema';
import { bindFiles } from '@/platform/files/bind-files';
// ddd-ts-kit:imports
import { PersonDirectoryContract } from '@/contexts/identity/published-language/index';
import { AppointmentExportContract } from '@/contexts/scheduling/published-language/index';
// /ddd-ts-kit:imports

/** The platform of a handler spec: no storage behind it, so every repository a test touches has to be faked. */
export const platformTestModule = defineContextModule({
  name: 'platform',
  register(builder) {
    builder.bind(KnexContext).toFactory(() => {
      throw new Error('A handler spec has no database: give a fake for the repository it uses.');
    });

    // The stores of the event-sourced aggregates, in memory: a spec reads what was appended through them.
    builder.bind(EventStore).toFactory(() => new InMemoryEventStore());
    builder.bind(SnapshotStore).toFactory(() => new InMemorySnapshotStore());
    builder.bind(CheckpointStore).toFactory(() => new InMemoryCheckpointStore());
    builder.bind(SubjectKeyStore).toFactory(() => new InMemorySubjectKeyStore());
    builder.bind(PersonalDataCipher).toFactory((resolve) => new PersonalDataCipher(resolve(SubjectKeyStore)));

    // In memory, and still held to the schema: a spec that writes a tuple the model does not know fails as the application would.
    builder
      .bind(RelationTupleStore)
      .toFactory(() => new SchemaCheckedTupleStore(relationshipSchema, new InMemoryRelationTupleStore()));

    // The files a handler spec stores stay in the memory of the test.
    bindFiles(builder, new InMemoryFileStorage());

    // ddd-ts-kit:test-bindings
    builder.bind(PersonDirectoryContract).toValue({ byIds: () => Promise.resolve([]) });

    builder
      .bind(AppointmentExportContract)
      .toValue({ export: () => Promise.resolve({ appointments: [] }), lookup: () => Promise.resolve([]) });
    // /ddd-ts-kit:test-bindings
  },
});
