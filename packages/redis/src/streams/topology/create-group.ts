import type { Redis } from 'ioredis';
import { failureCode } from '../errors/failure-code.js';
import type { GroupDescription } from './group-description.js';

const GROUP_EXISTS = 'REDIS_BUSYGROUP';

export async function createGroup(client: Redis, group: GroupDescription): Promise<void> {
  try {
    await client.xgroup('CREATE', group.stream, group.name, group.startFrom === 'new' ? '$' : '0', 'MKSTREAM');
  } catch (error) {
    if (failureCode(error) !== GROUP_EXISTS) throw error;
  }
}
