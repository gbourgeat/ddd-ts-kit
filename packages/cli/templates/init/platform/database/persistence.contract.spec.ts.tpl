import { afterEach, beforeEach, describe, expect, it } from '{{tests.module}}';
import { outboxStoreContract, processedEventStoreContract } from '@ddd-ts-kit/testing/contracts';
import { openPersistence } from './persistence.js';

const runner = { describe, it, expect, beforeEach, afterEach };

// TODO(platform): once the stores are yours, set `leaseMs` to the lease your outbox store is configured with.
outboxStoreContract(runner, { name: 'The outbox store of the platform', createStore: () => openPersistence().outbox, leaseMs: 30_000 });

processedEventStoreContract(runner, { name: 'The processed-event store of the platform', createStore: () => openPersistence().processedEvents });
