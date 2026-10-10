import { Clock } from '../../../../../../../src/index.js';
import { Adapter } from '../../../../../../../src/declarations.js';
import { ReminderSettings } from '../../application/ports/reminder-settings.port.js';
import { Reminders } from '../../application/ports/reminders.port.js';

const untouched = <T extends object>(instance: T): T => instance;

@Adapter(Reminders, { kind: 'external', transient: true, aspects: [untouched] }, [Clock, ReminderSettings])
export class SmsReminders implements Reminders {
  static built = 0;

  readonly sent: string[] = [];

  constructor(
    private readonly clock: Clock,
    private readonly settings: ReminderSettings,
  ) {
    SmsReminders.built += 1;
  }

  async remind(patientId: string): Promise<void> {
    this.sent.push(`${this.settings.sender}>${patientId}@${this.clock.now().toISOString()}`);
  }
}
