import type { Redis } from 'ioredis';

/** `QUIT` when the connection is up, a plain disconnection otherwise. Resolves once the socket is closed. */
export async function closeRedis(client: Redis): Promise<void> {
  if (client.status === 'end') {
    return;
  }

  // Between two attempts there is no socket whose closing could be awaited.
  const closing = client.status === 'reconnecting' ? Promise.resolve() : ended(client);

  // A connection that is not ready would queue the QUIT until it is, and may never be.
  if (client.status === 'ready') {
    await client.quit().catch(() => undefined);
  }

  client.disconnect();
  await closing;
}

function ended(client: Redis): Promise<void> {
  return new Promise((resolve) => {
    client.once('end', resolve);
  });
}
