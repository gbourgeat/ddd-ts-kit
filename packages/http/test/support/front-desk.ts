import type { Actor } from '@ddd-ts-kit/kernel';
import { controllerRoutes, type Route } from '../../src';
import type { Desk, StoredVisit, Visit } from '../fixtures/controllers/front-desk';

export type FrontDesk = typeof import('../fixtures/controllers/front-desk');

export const manager: Actor = { id: 'ada', type: 'user', tenantId: 'clinic-1', roles: ['manager'], attributes: {} };
export const nurse: Actor = { id: 'grace', type: 'user', tenantId: 'clinic-1', roles: ['nurse'], attributes: {} };

/** A desk that remembers what it was asked to book. */
export class RecordingDesk implements Desk {
  readonly booked: Visit[] = [];

  book(visit: Visit): string {
    this.booked.push(visit);

    return `visit-${this.booked.length}`;
  }

  visitOf(id: string): StoredVisit {
    return { id, patientId: 'patient-7', day: '2026-03-02', bookedBy: 'ada', internalNote: 'never leaves' };
  }
}

/** The routes of the fixture, each class built the way a composition root would: by its constructor. */
export function frontDeskRoutes(fixture: FrontDesk, desk: Desk): readonly Route[] {
  const built = new Map<unknown, unknown>([
    [fixture.BookVisitController, new fixture.BookVisitController(desk, new fixture.BookVisitMapper())],
    [fixture.GetVisitController, new fixture.GetVisitController(desk, new fixture.VisitSerializer())],
    [fixture.CancelVisitController, new fixture.CancelVisitController()],
    [fixture.SameClinicGuard, new fixture.SameClinicGuard(desk)],
  ]);

  const resolve = <T>(target: abstract new (...args: never) => T): T => {
    const instance = built.get(target);

    if (!(instance instanceof target)) {
      throw new Error(`Nothing builds ${target.name}.`);
    }

    return instance;
  };

  return controllerRoutes(
    [
      fixture.BookVisitController,
      fixture.GetVisitController,
      fixture.CancelVisitController,
      new fixture.OpeningHoursController(),
    ],
    { resolve },
  );
}
