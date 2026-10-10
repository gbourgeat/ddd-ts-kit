import { describe, expect, it } from 'vitest';
import { executeRoute } from '@ddd-ts-kit/http';
import { InMemoryCommandBus } from '@ddd-ts-kit/kernel';
import { JoinWaitlistCommand } from '@/contexts/scheduling/application/commands/join-waitlist/join-waitlist.command.js';
import { AlreadyWaitingError } from '@/contexts/scheduling/domain/errors/already-waiting.error.js';
import { joinWaitlistRoute } from '@/contexts/scheduling/presentation/http/join-waitlist.route.js';

const valid = { patientId: 'patient-1', appointmentTypeId: 'consultation', day: '2026-03-02' };

describe('POST /calendars/:calendarId/waitlist', () => {
  it('answers 201 with the identifier of the waitlist and hands the use case what the client sent', async () => {
    const received: JoinWaitlistCommand[] = [];

    const commands = new InMemoryCommandBus().register(JoinWaitlistCommand, {
      execute: async (command) => {
        received.push(command);

        return 'calendar-1.2026-03-02';
      },
    });

    const response = await executeRoute(joinWaitlistRoute(commands), request(valid), { validateResponses: true });

    expect(response).toMatchObject({ status: 201, body: { id: 'calendar-1.2026-03-02' } });
    expect(received).toMatchObject([{ calendarId: 'calendar-1', wait: valid }]);
  });

  it.each([
    ['a body without a patient', { appointmentTypeId: 'consultation', day: '2026-03-02' }],
    ['an empty appointment type', { ...valid, appointmentTypeId: '' }],
    ['a day that is not written YYYY-MM-DD', { ...valid, day: 'Monday' }],
  ])('refuses %s with 422', async (_case, body) => {
    const commands = new InMemoryCommandBus().register(JoinWaitlistCommand, {
      execute: async () => 'calendar-1.2026-03-02',
    });

    const response = await executeRoute(joinWaitlistRoute(commands), request(body), { validateResponses: true });

    expect(response.status).toBe(422);
  });

  it('answers the refusal of the use case with its code', async () => {
    const commands = new InMemoryCommandBus().register(JoinWaitlistCommand, {
      execute: async () => {
        throw new AlreadyWaitingError('patient-1');
      },
    });

    const response = await executeRoute(joinWaitlistRoute(commands), request(valid), { validateResponses: true });

    expect(response).toMatchObject({ status: 422, body: { code: 'ALREADY_WAITING' } });
  });
});

function request(body: unknown) {
  return { params: { calendarId: 'calendar-1' }, query: {}, headers: {}, body, raw: undefined };
}
