import { timestamp } from 'drizzle-orm/pg-core';

/** How every instant is stored: with its time zone, read back as a date. */
export function instant(name: string) {
  return timestamp(name, { withTimezone: true, mode: 'date' });
}
