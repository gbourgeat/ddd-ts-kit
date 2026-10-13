import { kernelNamesListener } from '../support/event-sourcing/kernel-names-listener.js';
import { defineRule } from '../support/rule/define-rule.js';

const STORE_NAMES = new Set([
  'EventStore',
  'SnapshotStore',
  'CheckpointStore',
  'EventSourcedRepository',
  'EventSerializer',
  'CatchUpSubscription',
  'InMemoryEventStore',
]);

export const eventSourcingStoreBehindRepository = defineRule<'store'>({
  id: 'event-sourcing/store-behind-repository',
  type: 'problem',
  recommended: 'error',
  description:
    'domain/ and application/ never name the event store, its snapshots, checkpoints, serializer or subscriptions: an event-sourced aggregate is loaded and saved through its repository port.',
  messages: {
    store:
      '{{name}} is named in {{layer}}/: the domain and the use cases never read the event store. Load and save the aggregate through its repository port; its adapter in infrastructure/persistence/ delegates to EventSourcedRepository, and a read across streams is a projection fed by the store.',
  },
  create({ file, report }) {
    const { location } = file;

    if (
      location.area !== 'context' ||
      file.isTest ||
      (location.layer !== 'domain' && location.layer !== 'application')
    ) {
      return {};
    }

    return kernelNamesListener(file, STORE_NAMES, ({ name, node }) => {
      report({ node, messageId: 'store', data: { name, layer: location.layer } });
    });
  },
});
