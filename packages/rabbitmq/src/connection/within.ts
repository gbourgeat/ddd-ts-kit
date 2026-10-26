/**
 * Waits for `work`, or for `ms`, whichever ends first: a broker that stopped answering (stalled,
 * or a connection cut that the client has not noticed yet) never holds a close forever.
 */
export async function within(ms: number, work: Promise<unknown> | undefined): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  await Promise.race([work, new Promise((resolve) => (timer = setTimeout(resolve, ms)))]);
  clearTimeout(timer);
}
