import { kernelNames } from '../event-sourcing/kernel-names.js';
import type { Rule } from '../model/rule.js';
import { perFile } from '../support/per-file.js';

/** What reads or writes a stream directly: only infrastructure and the composition root hold them. */
const STORE_NAMES = new Set([
  'EventStore',
  'SnapshotStore',
  'CheckpointStore',
  'EventSourcedRepository',
  'EventSerializer',
  'CatchUpSubscription',
  'InMemoryEventStore',
]);

const FIX =
  'Load and save the aggregate through its repository port (`findById`, `save`): its adapter in infrastructure/persistence/ delegates to `EventSourcedRepository`, and the composition root binds the store. A read that spans streams is a projection fed by the store.';

export const eventSourcingStoreBehindRepository: Rule = {
  id: 'event-sourcing/store-behind-repository',
  description:
    'domain/ and application/ never name the event store, its snapshots, checkpoints, serializer or subscriptions: an event-sourced aggregate is loaded and saved through its repository port.',
  scope: 'file',
  run(project) {
    return perFile(project, this.id, (file) => {
      const { location } = file;

      if (
        location.area !== 'context' ||
        file.isTest ||
        (location.layer !== 'domain' && location.layer !== 'application')
      ) {
        return [];
      }

      return kernelNames(file, STORE_NAMES).map(({ name, line }) => ({
        line,
        message: `${name} is named in ${location.layer}/: ${location.layer === 'domain' ? 'the domain never reads' : 'the use cases never read'} the event store.`,
        fix: FIX,
      }));
    });
  },
};
