import { InMemoryRelationTupleStore, RelationTupleStore, SchemaCheckedTupleStore } from '@ddd-ts-kit/auth/rebac';
import { defineContextModule } from '@ddd-ts-kit/di';
import { KnexContext } from '@ddd-ts-kit/knex';
import { relationshipSchema } from './auth/relationship-schema.js';
// ddd-ts-kit:imports
import { PersonDirectoryContract } from '../contexts/identity/published-language/index.js';
import { AppointmentExportContract } from '../contexts/scheduling/published-language/index.js';
// /ddd-ts-kit:imports

/** The platform of a handler spec: no storage behind it, so every repository a test touches has to be faked. */
export const platformTestModule = defineContextModule({
  name: 'platform',
  register(builder) {
    builder.bind(KnexContext).toFactory(() => {
      throw new Error('A handler spec has no database: give a fake for the repository it uses.');
    });

    // In memory, and still held to the schema: a spec that writes a tuple the model does not know fails as the application would.
    builder.bind(RelationTupleStore).toFactory(() => new SchemaCheckedTupleStore(relationshipSchema, new InMemoryRelationTupleStore()));

    // ddd-ts-kit:test-bindings
    builder.bind(PersonDirectoryContract).toValue({ byIds: () => Promise.resolve([]) });
    builder.bind(AppointmentExportContract).toValue({ export: () => Promise.resolve({ appointments: [] }), lookup: () => Promise.resolve([]) });
    // /ddd-ts-kit:test-bindings
  },
});
