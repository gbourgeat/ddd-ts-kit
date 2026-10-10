import { pageOf, type Page, type StampedRow } from '@ddd-ts-kit/kernel';
import type { AppointmentExportGateway } from '../../application/ports/appointment-export-gateway.port.js';
import type { Outcome } from '../../application/ports/outcome-register.port.js';

const PAGE_SIZE = 2;

/** What scheduling states of its appointments, given by the test as outcomes: two a page, each stamped with the instant it last changed. */
export class FakeAppointmentExportGateway implements AppointmentExportGateway {
  constructor(private readonly outcomes: readonly Outcome[] = []) {}

  async export(cursor: string | undefined): Promise<Page<StampedRow<Outcome>>> {
    const start = cursor === undefined ? 0 : Number(cursor);
    const next = start + PAGE_SIZE;
    const items = this.outcomes.slice(start, next).map(stamped);

    return pageOf(items, next < this.outcomes.length ? { nextCursor: String(next) } : {});
  }

  async lookup(appointmentIds: readonly string[]): Promise<ReadonlyMap<string, StampedRow<Outcome>>> {
    const known = this.outcomes.filter((outcome) => appointmentIds.includes(outcome.id));

    return new Map(known.map((outcome) => [outcome.id, stamped(outcome)]));
  }
}

function stamped(outcome: Outcome): StampedRow<Outcome> {
  return { key: outcome.id, row: outcome, stamp: { eventId: '', occurredAt: outcome.changedAt } };
}
