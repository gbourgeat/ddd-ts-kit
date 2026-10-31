import { describe, expect, it } from 'vitest';
import { InMemoryCommandBus, type Message } from '@ddd-ts-kit/kernel';
import { InMemoryAuditTrail, auditMiddleware } from '../src';
import { aSource, ada } from './support/fixtures';
import { aRescheduling } from './support/scheduling/a-rescheduling';
import { CancelAppointmentCommand } from './support/scheduling/application/commands/cancel-appointment.command';
import { RescheduleAppointmentCommand } from './support/scheduling/application/commands/reschedule-appointment.command';

/** The clinic a cancellation acts on, which is not the tenant of the token of Ada. */
const clinicOf = (message: Message): string | undefined =>
  message instanceof CancelAppointmentCommand ? 'globex' : undefined;

function commandsWritingTo(trail: InMemoryAuditTrail): InMemoryCommandBus {
  return new InMemoryCommandBus()
    .use(auditMiddleware(trail, { ...aSource(), tenantOf: clinicOf }))
    .register(CancelAppointmentCommand, {
      execute: async ({ appointmentId }) => {
        if (appointmentId === 'apt-elsewhere') {
          throw new Error('not a clinic of the caller');
        }
      },
    })
    .register(RescheduleAppointmentCommand, { execute: async ({ appointmentId }) => appointmentId });
}

describe('auditMiddleware, with tenantOf', () => {
  it('writes a command that succeeded in the chain of the tenant it names, its actor still of its own tenant', async () => {
    const trail = new InMemoryAuditTrail();

    await commandsWritingTo(trail).execute(new CancelAppointmentCommand(ada, 'apt-1'));

    expect(trail.entries).toMatchObject([
      {
        chain: 'tenant:globex',
        tenantId: 'globex',
        action: 'CancelAppointmentCommand',
        outcome: 'succeeded',
        actor: { id: 'ada', tenantId: 'acme' },
      },
    ]);
  });

  it('keeps a failure, and a message that names no tenant, in the tenant of the work', async () => {
    const trail = new InMemoryAuditTrail();
    const commands = commandsWritingTo(trail);

    await expect(commands.execute(new CancelAppointmentCommand(ada, 'apt-elsewhere'))).rejects.toThrow();
    await commands.execute(new RescheduleAppointmentCommand(ada, aRescheduling()));

    expect(trail.entries.map(({ chain, outcome, action }) => ({ chain, outcome, action }))).toEqual([
      { chain: 'tenant:acme', outcome: 'failed', action: 'CancelAppointmentCommand' },
      { chain: 'tenant:acme', outcome: 'succeeded', action: 'RescheduleAppointmentCommand' },
    ]);
  });
});
