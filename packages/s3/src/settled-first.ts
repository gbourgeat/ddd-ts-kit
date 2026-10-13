/**
 * Waits for the stream that feeds an upload and for the upload, and rejects with the failure of
 * the stream first: when the content was refused on its way, the upload only says it was cut.
 */
export async function settledFirst(feeding: Promise<void>, uploading: Promise<unknown>): Promise<void> {
  const [fed, uploaded] = await Promise.allSettled([feeding, uploading]);

  if (fed.status === 'rejected') {
    throw fed.reason;
  }

  if (uploaded.status === 'rejected') {
    throw uploaded.reason;
  }
}
