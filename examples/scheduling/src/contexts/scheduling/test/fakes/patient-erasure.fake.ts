import type { PatientErasure } from '@/contexts/scheduling/calendars/application/ports/patient-erasure.port';

/** Counts the rows each person has, as a test gave them, and forgets them at the first erasure. */
export class FakePatientErasure implements PatientErasure {
  private readonly rows = new Map<string, number>();

  readonly erased: string[] = [];

  /** The rows the erasure of this person reaches, as the test arranges them. */
  holds(personId: string, rows: number): this {
    this.rows.set(personId, rows);

    return this;
  }

  async erase(personId: string): Promise<number> {
    const reached = this.rows.get(personId) ?? 0;

    this.rows.delete(personId);
    this.erased.push(personId);

    return reached;
  }
}
