import { InMemoryRepository } from '@ddd-ts-kit/testing';
import { Appointment } from '@/contexts/scheduling/domain/aggregates/appointment.aggregate.js';
import type { AppointmentRepository } from '@/contexts/scheduling/domain/repositories/appointment.repository.js';
import { SlotTakenError } from '@/contexts/scheduling/domain/errors/slot-taken.error.js';
import { Slot } from '@/contexts/scheduling/domain/value-objects/slot.vo.js';

export class FakeAppointmentRepository extends InMemoryRepository<Appointment> implements AppointmentRepository {
  constructor() {
    // A copy by rehydration and not a snapshot: the state holds value objects, which a structured clone would turn into plain data.
    super({ clone: (stored: Appointment) => Appointment.rehydrate(stored.id, stored.toState()) });
  }

  /** Like the storage, the fake holds a time on a calendar once. */
  override async save(saved: Appointment): Promise<void> {
    const taken = this.all().some(
      (stored) =>
        stored.id !== saved.id && stored.calendarId === saved.calendarId && saved.isActive && stored.holds(saved.slot),
    );

    if (taken) {
      throw new SlotTakenError(saved.calendarId, saved.slot.startsAt);
    }

    await super.save(saved);
  }

  async heldOn(calendarId: string, from: Date, until: Date): Promise<readonly Appointment[]> {
    const span = Slot.between(from, until, until);

    return byStart(this.all().filter((stored) => stored.calendarId === calendarId && stored.holds(span)));
  }

  async heldBy(patientId: string, practitionerId: string, instant: Date): Promise<readonly Appointment[]> {
    return byStart(
      this.all().filter(
        (stored) =>
          stored.patientId === patientId &&
          stored.booking.practitionerId === practitionerId &&
          stored.isHeldAfter(instant),
      ),
    );
  }

  async unconfirmedAt(instant: Date): Promise<readonly Appointment[]> {
    const due = this.all().filter((stored) => stored.status === 'requested' && deadlineOf(stored) <= instant.getTime());

    return due.sort((first, second) => deadlineOf(first) - deadlineOf(second));
  }
}

function byStart(appointments: Appointment[]): Appointment[] {
  return appointments.sort((first, second) => first.slot.startsAt.getTime() - second.slot.startsAt.getTime());
}

function deadlineOf(appointment: Appointment): number {
  return appointment.confirmBefore?.getTime() ?? Number.POSITIVE_INFINITY;
}
