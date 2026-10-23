import type { Redis } from 'ioredis';
import { createGroup } from './create-group';
import type { RedisStreamsTopology } from './redis-streams-topology';

/** Idempotent: a group that exists is left where it is, a stream that does not is created empty. */
export async function declareTopology(client: Redis, topology: RedisStreamsTopology): Promise<void> {
  for (const group of topology.groups) {
    await createGroup(client, group);
  }
}
