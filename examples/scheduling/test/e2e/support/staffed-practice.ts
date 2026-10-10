/** A practice a patient can book in: its staff, the calendar of its practitioner and the appointment type that calendar offers. */
export interface StaffedPractice {
  readonly practiceId: string;
  readonly managerId: string;
  readonly practitionerId: string;
  readonly assistantId: string;
  readonly calendarId: string;
  readonly appointmentTypeId: string;
}
