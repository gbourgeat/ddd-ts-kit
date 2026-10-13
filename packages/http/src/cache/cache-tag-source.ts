/**
 * A resource an answer shows, named as a cache tag so that a change of that resource purges
 * the answer: `{ resource: 'calendar', param: 'calendarId' }` tags `calendar:<calendarId>`;
 * `{ resource: 'appointment', field: 'items.id' }` tags each value found at that path of the
 * body (a list is walked through); `{ resource: 'appointment' }` tags the whole kind, which a
 * change of any appointment purges.
 */
export type CacheTagSource =
  | { readonly resource: string; readonly param: string }
  | { readonly resource: string; readonly field: string }
  | { readonly resource: string };
