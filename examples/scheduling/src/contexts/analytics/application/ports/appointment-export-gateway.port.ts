import type { Page, StampedRow } from '@ddd-ts-kit/kernel';
import type { Outcome } from '@/contexts/analytics/application/ports/outcome-register.port.js';

/** What scheduling states of its appointments now: the source the outcomes are rebuilt from. */
export abstract class AppointmentExportGateway {
  /** Every outcome, page by page, in a stable order: without a cursor the first page, then the `nextCursor` of the previous one. */
  abstract export(cursor: string | undefined): Promise<Page<StampedRow<Outcome>>>;

  /** The outcomes of these appointments as they are now; an appointment scheduling does not know is left out. */
  abstract lookup(appointmentIds: readonly string[]): Promise<ReadonlyMap<string, StampedRow<Outcome>>>;
}
