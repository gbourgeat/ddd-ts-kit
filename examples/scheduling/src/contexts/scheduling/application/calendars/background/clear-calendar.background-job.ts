import {
  isRefusal,
  type Actor,
  type BackgroundJob,
  type BackgroundJobExecution,
  type CommandBus,
} from '@ddd-ts-kit/kernel';
import { Background } from '@ddd-ts-kit/kernel/declarations';
import { CancelAppointmentCommand } from '@/contexts/scheduling/application/calendars/commands/cancel-appointment/cancel-appointment.command';

/** The appointments to cancel, named when the clearance was asked, and the reason their patients read. */
export interface ClearCalendarPayload {
  readonly calendarId: string;
  readonly appointmentIds: readonly string[];
  readonly reason: string;
}

/** What an attempt left behind: the number of appointments of the payload already handled. */
interface ClearCalendarCheckpoint {
  readonly done: number;
}

/** A clearance of a few thousand appointments runs for minutes: each attempt has half an hour. */
const ATTEMPT_TIMEOUT = '30m';

/** The code of an appointment that is over: cancelled meanwhile, by its patient or by an attempt that died. */
const ENDED = 'APPOINTMENT_ENDED';

/**
 * Cancels the appointments of a clearance one by one, as the person who asked for it, and says
 * how far it went: each cancellation is its own command and its own unit of work, the checkpoint
 * after it lets the next attempt resume there, and the signal is read between two of them.
 */
@Background({ timeout: ATTEMPT_TIMEOUT, lease: '1m' })
export class ClearCalendarBackgroundJob implements BackgroundJob<ClearCalendarPayload> {
  static readonly jobName = 'scheduling.clear-calendar';

  constructor(private readonly commands: CommandBus) {}

  async run(payload: ClearCalendarPayload, execution: BackgroundJobExecution): Promise<void> {
    const { appointmentIds } = payload;
    const total = appointmentIds.length;
    let done = doneBefore(execution.checkpoint);

    await execution.reportProgress({ done, total });

    for (const appointmentId of appointmentIds.slice(done)) {
      execution.signal.throwIfAborted();
      await this.cancel(appointmentId, payload.reason, execution.actor);
      done += 1;

      const checkpoint: ClearCalendarCheckpoint = { done };

      await execution.saveCheckpoint(checkpoint);
      await execution.reportProgress({ done, total });
    }
  }

  /** An appointment that is already over is what the clearance wants: the next one follows. */
  private async cancel(appointmentId: string, reason: string, actor: Actor): Promise<void> {
    try {
      await this.commands.execute(new CancelAppointmentCommand(actor, appointmentId, reason));
    } catch (error) {
      if (!isRefusal(error, ENDED)) {
        throw error;
      }
    }
  }
}

function doneBefore(checkpoint: unknown): number {
  return typeof checkpoint === 'object' &&
    checkpoint !== null &&
    'done' in checkpoint &&
    typeof checkpoint.done === 'number'
    ? checkpoint.done
    : 0;
}
