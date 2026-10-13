import type { Page } from '@ddd-ts-kit/kernel';

/**
 * The items of every page of a search, read page after page as a streamed list is written: give
 * it what sends the query of one page through the bus, so that each page is read through the
 * middlewares of the bus (authorization, unit of work, tenant session, timeout, tracing, error
 * reporting) inside the scope of the request:
 *
 *     return everyPage((cursor) => this.queries.execute(new SearchAgendaQuery(actor, practiceId, pageAt(cursor))));
 *
 * A query handler that answers a lazy list instead is read after the bus has returned, outside
 * of all of them. A page that fails once the status is sent cuts the response short and is
 * reported to `onError` as an interrupted fault.
 */
export async function* everyPage<T>(readPage: (cursor: string | undefined) => Promise<Page<T>>): AsyncIterable<T> {
  let cursor: string | undefined;

  do {
    const page = await readPage(cursor);

    yield* page.items;
    cursor = page.nextCursor;
  } while (cursor !== undefined);
}
