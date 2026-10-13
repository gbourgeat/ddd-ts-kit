/**
 * The same chunks; a failure while they are read, once the status is sent, is told to `report`
 * before it cuts the response short, the only thing it can still do to it.
 */
export async function* reportedStream(
  chunks: AsyncIterable<string>,
  report: (error: unknown) => void,
): AsyncIterable<string> {
  try {
    yield* chunks;
  } catch (error) {
    report(error);

    throw error;
  }
}
