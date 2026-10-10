import type { HttpClient, HttpResponse } from '@ddd-ts-kit/testing/e2e';
import type { StaffedPractice } from './staffed-practice.js';

/** What a caller asks of `POST /appointments`: a start on the calendar of the practice, for themselves unless a patient is named. */
export interface Wish {
  readonly startsAt: Date;
  readonly patientId?: string;
}

export function bookAppointment(
  caller: HttpClient,
  practice: StaffedPractice,
  wish: Wish,
): Promise<HttpResponse<{ id: string }>> {
  const { calendarId, appointmentTypeId } = practice;
  const patient = wish.patientId === undefined ? {} : { patientId: wish.patientId };

  return caller.post<{ id: string }>('/appointments', {
    calendarId,
    appointmentTypeId,
    startsAt: wish.startsAt.toISOString(),
    ...patient,
  });
}
