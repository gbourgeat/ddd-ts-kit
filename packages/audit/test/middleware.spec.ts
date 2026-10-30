import { describe, expect, it } from 'vitest';
import {
  FixedExecutionScope,
  InMemoryCommandBus,
  InMemoryLogger,
  InMemoryQueryBus,
  NoExecutionContextError,
  unitOfWorkMiddleware,
} from '@ddd-ts-kit/kernel';
import {
  InMemoryAuditTrail,
  UNEXPECTED_ERROR,
  auditMiddleware,
  auditedFields,
  logLostRecords,
  type AuditMiddlewareOptions,
  type AuditRecord,
  type AuditTrail,
} from '../src';
import { NOW, aSource, ada } from './support/fixtures';
import { StagingUnitOfWork } from './support/staging-unit-of-work';
import { TransactionalAuditTrail } from './support/transactional-audit-trail';
import { aRescheduling } from './support/scheduling/a-rescheduling';
import { CancelAppointmentCommand } from './support/scheduling/application/commands/cancel-appointment.command';
import { RescheduleAppointmentCommand } from './support/scheduling/application/commands/reschedule-appointment.command';
import { SearchAppointmentsQuery } from './support/scheduling/application/queries/search-appointments.query';
import { ReadMedicalFileQuery } from './support/scheduling/application/queries/read-medical-file.query';
import { AppointmentAlreadyCancelled } from './support/scheduling/domain/errors/appointment-already-cancelled';

/** A command bus as a composition root builds it: audit, then the unit of work, then the handlers. */
function application(options: Partial<AuditMiddlewareOptions> = {}) {
  const committed = new InMemoryAuditTrail();
  const unitOfWork = new StagingUnitOfWork();
  const appointments: string[] = [];
  const trail = new TransactionalAuditTrail(unitOfWork, committed);
  const audit = auditMiddleware(trail, { ...aSource(), unitOfWork, ...options });

  const cancel = async (command: CancelAppointmentCommand) => {
    await unitOfWork.write(async () => void appointments.push(`${command.appointmentId} cancelled`));

    if (command.appointmentId === 'apt-gone') {
      throw new AppointmentAlreadyCancelled('Appointment apt-gone is already cancelled');
    }

    if (command.appointmentId === 'apt-broken') {
      throw new Error('connection reset while writing to patient lin@example.org');
    }
  };

  const commands = new InMemoryCommandBus()
    .use(audit)
    .use(unitOfWorkMiddleware(unitOfWork))
    .register(CancelAppointmentCommand, { execute: cancel })
    .register(RescheduleAppointmentCommand, { execute: async (command) => command.appointmentId });

  const queries = new InMemoryQueryBus()
    .use(audit)
    .register(SearchAppointmentsQuery, { execute: async () => ['apt-1'] })
    .register(ReadMedicalFileQuery, { execute: async () => 'file' });

  return { committed, unitOfWork, appointments, commands, queries };
}

const outcomes = (trail: InMemoryAuditTrail) =>
  trail.entries.map(({ action, outcome, reason }) => ({ action, outcome, reason }));

describe('auditMiddleware', () => {
  it('records a command that succeeded, with who sent it and under which correlation', async () => {
    const { committed, commands } = application();

    await commands.execute(new CancelAppointmentCommand(ada, 'apt-1'));

    expect(committed.entries[0]).toMatchObject({
      id: 'audit-1',
      occurredAt: NOW,
      category: 'command',
      action: 'CancelAppointmentCommand',
      outcome: 'succeeded',
      actor: { id: 'ada', type: 'user', tenantId: 'acme' },
      correlationId: 'correlation-1',
      causationId: 'request-1',
      origin: 'http',
    });

    expect(committed.entries[0]).not.toHaveProperty('reason');
  });

  it('gives the caller what the handler answered', async () => {
    const { commands } = application();

    expect(await commands.execute(new RescheduleAppointmentCommand(ada, aRescheduling()))).toBe('apt-1');
  });

  it('keeps the entry of a failed command although its transaction rolled back, with the code of the domain error', async () => {
    const { committed, appointments, commands } = application();

    await expect(commands.execute(new CancelAppointmentCommand(ada, 'apt-gone'))).rejects.toThrow(
      AppointmentAlreadyCancelled,
    );

    expect(appointments).toEqual([]);

    expect(outcomes(committed)).toEqual([
      { action: 'CancelAppointmentCommand', outcome: 'failed', reason: 'APPOINTMENT_ALREADY_CANCELLED' },
    ]);
  });

  it('writes the entry of a succeeded command in its transaction: no commit, no entry saying it succeeded', async () => {
    const { committed, unitOfWork, appointments, commands } = application();

    unitOfWork.failOnCommit = true;

    await expect(commands.execute(new CancelAppointmentCommand(ada, 'apt-1'))).rejects.toThrow(
      'The commit was refused',
    );

    expect(appointments).toEqual([]);

    expect(outcomes(committed)).toEqual([
      { action: 'CancelAppointmentCommand', outcome: 'failed', reason: UNEXPECTED_ERROR },
    ]);
  });

  it('commits the entry and the state change together', async () => {
    const { committed, appointments, commands } = application();

    await commands.execute(new CancelAppointmentCommand(ada, 'apt-1'));

    expect(appointments).toEqual(['apt-1 cancelled']);

    expect(outcomes(committed)).toEqual([
      { action: 'CancelAppointmentCommand', outcome: 'succeeded', reason: undefined },
    ]);
  });

  it('never lets the class or the message of an unexpected error into the trail', async () => {
    const { committed, commands } = application();

    await expect(commands.execute(new CancelAppointmentCommand(ada, 'apt-broken'))).rejects.toThrow('connection reset');

    expect(committed.entries[0]?.reason).toBe(UNEXPECTED_ERROR);
    expect(JSON.stringify(committed.entries)).not.toContain('lin@example.org');
  });
});

describe('auditMiddleware when the trail fails, or without a unit of work', () => {
  it('fails the command, and rolls it back, when its entry cannot be written', async () => {
    const committed = new InMemoryAuditTrail();
    const unitOfWork = new StagingUnitOfWork();
    const appointments: string[] = [];

    const refusingSuccesses: AuditTrail = {
      record: async (record) => {
        if (record.outcome === 'succeeded') {
          throw new Error('The audit store is unreachable');
        }

        await committed.record(record);
      },
    };

    const commands = new InMemoryCommandBus()
      .use(auditMiddleware(refusingSuccesses, { ...aSource(), unitOfWork }))
      .use(unitOfWorkMiddleware(unitOfWork))
      .register(CancelAppointmentCommand, {
        execute: () => unitOfWork.write(async () => void appointments.push('cancelled')),
      });

    await expect(commands.execute(new CancelAppointmentCommand(ada, 'apt-1'))).rejects.toThrow(
      'The audit store is unreachable',
    );

    expect(appointments).toEqual([]);

    expect(outcomes(committed)).toEqual([
      { action: 'CancelAppointmentCommand', outcome: 'failed', reason: UNEXPECTED_ERROR },
    ]);
  });

  it('gives the caller the failure of the use case, not the failure of its audit, and reports the lost entry', async () => {
    const lost: (AuditRecord | undefined)[] = [];
    const down: AuditTrail = { record: async () => Promise.reject(new Error('The audit store is unreachable')) };

    const commands = new InMemoryCommandBus()
      .use(auditMiddleware(down, { ...aSource(), onLostRecord: (_error, record) => void lost.push(record) }))
      .register(CancelAppointmentCommand, {
        execute: async () => Promise.reject(new AppointmentAlreadyCancelled('Already cancelled')),
      });

    await expect(commands.execute(new CancelAppointmentCommand(ada, 'apt-1'))).rejects.toThrow(
      AppointmentAlreadyCancelled,
    );

    expect(lost.map((record) => record?.reason)).toEqual(['APPOINTMENT_ALREADY_CANCELLED']);
  });

  it('writes the lost entry to the log, its action and the type of the failure, never the message of the failure', async () => {
    const logger = new InMemoryLogger();

    const down: AuditTrail = {
      record: async () => Promise.reject(new Error('insert failed, params: ada@example.org')),
    };

    const commands = new InMemoryCommandBus()
      .use(auditMiddleware(down, { ...aSource(), onLostRecord: logLostRecords(logger) }))
      .register(CancelAppointmentCommand, {
        execute: async () => Promise.reject(new AppointmentAlreadyCancelled('Already cancelled')),
      });

    await expect(commands.execute(new CancelAppointmentCommand(ada, 'apt-1'))).rejects.toThrow(
      AppointmentAlreadyCancelled,
    );

    expect(logger.entries).toEqual([
      {
        level: 'error',
        message: 'audit entry lost',
        fields: {
          errorType: 'Error',
          category: 'command',
          action: 'CancelAppointmentCommand',
          reason: 'APPOINTMENT_ALREADY_CANCELLED',
        },
      },
    ]);
  });

  it('writes a lost entry to the log when not even its record could be built', () => {
    const logger = new InMemoryLogger();

    logLostRecords(logger)(new NoExecutionContextError(), undefined);

    expect(logger.entries).toEqual([
      {
        level: 'error',
        message: 'audit entry lost',
        fields: { errorType: 'NoExecutionContextError' },
      },
    ]);
  });

  it('records after the handler when it is given no unit of work', async () => {
    const trail = new InMemoryAuditTrail();

    const commands = new InMemoryCommandBus()
      .use(auditMiddleware(trail, aSource()))
      .register(CancelAppointmentCommand, { execute: async () => undefined });

    await commands.execute(new CancelAppointmentCommand(ada, 'apt-1'));

    expect(outcomes(trail)).toEqual([{ action: 'CancelAppointmentCommand', outcome: 'succeeded', reason: undefined }]);
  });
});

describe('auditMiddleware, queries, declared fields and the execution context', () => {
  it('leaves queries alone by default, records the ones it is given, or all of them', async () => {
    const none = application();
    const some = application({ queries: [ReadMedicalFileQuery] });
    const all = application({ queries: 'all' });

    for (const { queries } of [none, some, all]) {
      await queries.execute(new SearchAppointmentsQuery(ada));
      await queries.execute(new ReadMedicalFileQuery(ada, 'patient-9'));
    }

    expect(none.committed.entries).toEqual([]);

    expect(some.committed.entries.map(({ category, action }) => ({ category, action }))).toEqual([
      { category: 'query', action: 'ReadMedicalFileQuery' },
    ]);

    expect(all.committed.entries.map((entry) => entry.action)).toEqual([
      'SearchAppointmentsQuery',
      'ReadMedicalFileQuery',
    ]);
  });

  it('records the declared fields of a failed command too', async () => {
    const fields = [
      auditedFields(CancelAppointmentCommand, ['appointmentId'], {
        resource: (command) => ({ type: 'appointment', id: command.appointmentId }),
      }),
    ];

    const { committed, commands } = application({ fields });

    await expect(commands.execute(new CancelAppointmentCommand(ada, 'apt-gone'))).rejects.toThrow(
      AppointmentAlreadyCancelled,
    );

    expect(committed.entries[0]).toMatchObject({
      outcome: 'failed',
      changes: { appointmentId: 'apt-gone' },
      resource: { type: 'appointment', id: 'apt-gone' },
    });
  });

  it('refuses to guess who acts when no execution context was opened: a wiring mistake', async () => {
    const commands = new InMemoryCommandBus()
      .use(auditMiddleware(new InMemoryAuditTrail(), { ...aSource(), scope: new FixedExecutionScope() }))
      .register(CancelAppointmentCommand, { execute: async () => undefined });

    await expect(commands.execute(new CancelAppointmentCommand(ada, 'apt-1'))).rejects.toThrow(NoExecutionContextError);
  });
});
