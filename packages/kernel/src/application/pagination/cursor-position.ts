/** Where a cursor page ended: the sort values of its last item, tie-breaker included. */
export type CursorPosition = Readonly<Record<string, string | number | boolean | null>>;
