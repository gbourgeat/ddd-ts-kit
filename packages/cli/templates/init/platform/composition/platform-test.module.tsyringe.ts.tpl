{{#if eventSourcing.on}}
import { defineContextModule, type ModuleBuilder } from '@ddd-ts-kit/di';
import {
  CheckpointStore,
  EventStore,
  InMemoryCheckpointStore,
  InMemoryEventStore,
{{#if files.any}}
  InMemoryFileStorage,
{{/if}}
  InMemorySnapshotStore,
  InMemorySubjectKeyStore,
  PersonalDataCipher,
  SnapshotStore,
  SubjectKeyStore,
} from '@ddd-ts-kit/kernel';
{{/if}}
{{#unless eventSourcing.on}}
import { defineContextModule } from '@ddd-ts-kit/di';
{{#if files.any}}
import { InMemoryFileStorage } from '@ddd-ts-kit/kernel';
{{/if}}
{{/unless}}
{{#if persistence.packagedToken}}
import { {{persistence.token}} } from '{{persistence.tokenPackage}}';
{{/if}}
{{#if persistence.ownDatabase}}
import { Database } from '{{alias.platform}}/database/database{{alias.ext}}';
{{/if}}
{{#if files.any}}
import { bindFiles } from '{{alias.platform}}/files/bind-files{{alias.ext}}';
{{/if}}
// ddd-ts-kit:imports
// /ddd-ts-kit:imports

/** The platform of a handler spec: no storage behind it, so every repository a test touches has to be faked. */
export const platformTestModule = defineContextModule({
  name: 'platform',
  register(builder) {
    {{#if persistence.hasDatabase}}
    builder.bind({{persistence.token}}).toFactory(() => {
      throw new Error('A handler spec has no database: give a fake for the repository it uses.');
    });

    {{/if}}
    {{#if files.any}}
    // The files a handler spec stores stay in the memory of the test.
    bindFiles(builder, new InMemoryFileStorage());

    {{/if}}
    {{#if eventSourcing.on}}
    // The stored events, the snapshots, the checkpoints and the keys of a handler spec stay in the memory of the test: an event-sourced aggregate needs no fake.
    bindEventSourcing(builder);

    {{/if}}
    // ddd-ts-kit:test-bindings
    // /ddd-ts-kit:test-bindings
  },
});
{{#if eventSourcing.on}}

function bindEventSourcing(builder: ModuleBuilder): void {
  const subjectKeys = new InMemorySubjectKeyStore();

  builder.bind(EventStore).toValue(new InMemoryEventStore());
  builder.bind(SnapshotStore).toValue(new InMemorySnapshotStore());
  builder.bind(CheckpointStore).toValue(new InMemoryCheckpointStore());
  builder.bind(SubjectKeyStore).toValue(subjectKeys);
  builder.bind(PersonalDataCipher).toValue(new PersonalDataCipher(subjectKeys));
}
{{/if}}
