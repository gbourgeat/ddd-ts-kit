export abstract class Reminders {
  abstract remind(patientId: string): Promise<void>;
}
