import type { Page } from '../pagination/page';
import { Hydration } from './hydration';

/**
 * Completes the rows of a read with data of other bounded contexts, one call per relation for
 * the whole page and never one per row:
 * `await hydrate(page).with('practitioner', (row) => row.practitionerId, practitioners.byIds)`.
 * A list of rows is hydrated as a page of them.
 */
export function hydrate<Row extends object>(source: Page<Row> | readonly Row[]): Hydration<Row> {
  return Hydration.of('items' in source ? source : { items: source });
}
