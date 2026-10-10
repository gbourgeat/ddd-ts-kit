import { describe, expect, it } from 'vitest';
import { InMemoryCommandBus, InMemoryQueryBus } from '@ddd-ts-kit/kernel';
import {
  AuthorizationMap,
  ForbiddenError,
  authorizationMiddleware,
  definePermissions,
  requires,
  type OnDecision,
} from '@ddd-ts-kit/auth';
import { AllowAll, DenyAll } from '@ddd-ts-kit/auth/testing';
import { InMemoryAuditTrail, auditDecisions, verifyChain, type AuditDecisionsOptions } from '../src/index.js';
import { NOW, aSource, ada, requestOf, support } from './support/fixtures.js';
import { CancelAppointmentCommand } from './support/scheduling/application/commands/cancel-appointment.command.js';
import { SaveSearchQuery } from './support/scheduling/application/commands/save-search-query.command.js';
import { ListAppointmentsQuery } from './support/scheduling/application/queries/list-appointments.query.js';
import { ReadMedicalFileQuery } from './support/scheduling/application/queries/read-medical-file.query.js';
import { UpcomingAppointments } from './support/scheduling/application/queries/upcoming-appointments.query.js';

const permissions = definePermissions('scheduling', {
  'appointment.cancel': { description: 'Cancel an appointment' },
  'appointment.read': { description: 'List appointments' },
  'medical-file.read': { description: 'Read the medical file of a patient' },
  'search.save': { description: 'Save a search' },
});

const map = AuthorizationMap.of(
  requires(CancelAppointmentCommand, permissions['appointment.cancel'], {
    resource: (command) => ({ type: 'appointment', id: command.appointmentId }),
  }),
  requires(ListAppointmentsQuery, permissions['appointment.read']),
  requires(UpcomingAppointments, permissions['appointment.read']),
  requires(SaveSearchQuery, permissions['search.save']),
  requires(ReadMedicalFileQuery, permissions['medical-file.read'], {
    resource: (query) => ({ type: 'patient', id: query.patientId }),
  }),
);

function application(authorizer = new AllowAll(), options: Partial<AuditDecisionsOptions> = {}) {
  const trail = new InMemoryAuditTrail();
  const source = aSource();

  // Typed as the hook of the middleware: the structural type of this package must fit it.
  const onDecision: OnDecision = auditDecisions(trail, {
    ...source,
    sensitivePermissions: ['scheduling:medical-file.read'],
    ...options,
  });

  const guard = authorizationMiddleware({ authorizer, map, onDecision });

  const commands = new InMemoryCommandBus()
    .use(guard)
    .register(CancelAppointmentCommand, { execute: async () => undefined })
    .register(SaveSearchQuery, { execute: async () => undefined });

  const queries = new InMemoryQueryBus()
    .use(guard)
    .register(ListAppointmentsQuery, { execute: async () => ['apt-1'] })
    .register(UpcomingAppointments, { execute: async () => ['apt-1'] })
    .register(ReadMedicalFileQuery, { execute: async () => 'file' });

  return { trail, source, commands, queries };
}

describe('auditDecisions', () => {
  it('records an allowed command with the permission as action, the resource and who asked', async () => {
    const { trail, commands } = application();

    await commands.execute(new CancelAppointmentCommand(ada, 'apt-1'));

    expect(trail.entries).toEqual([
      {
        id: 'audit-1',
        chain: 'tenant:acme',
        sequence: 1,
        occurredAt: NOW,
        category: 'authorization',
        action: 'scheduling:appointment.cancel',
        outcome: 'allowed',
        actor: { id: 'ada', type: 'user', tenantId: 'acme' },
        tenantId: 'acme',
        resource: { type: 'appointment', id: 'apt-1' },
        context: 'scheduling',
        correlationId: 'correlation-1',
        causationId: 'request-1',
        origin: 'http',
        extensions: {},
        previousHash: trail.entries[0]?.previousHash,
        hash: trail.entries[0]?.hash,
      },
    ]);
  });

  it('records a refusal with its reason code, for a command as for a query', async () => {
    const { trail, commands, queries } = application(new DenyAll('NO_MATCHING_ROLE'));

    await expect(commands.execute(new CancelAppointmentCommand(ada, 'apt-1'))).rejects.toThrow(ForbiddenError);
    await expect(queries.execute(new ListAppointmentsQuery(ada))).rejects.toThrow(ForbiddenError);

    expect(trail.entries.map(({ action, outcome, reason }) => ({ action, outcome, reason }))).toEqual([
      { action: 'scheduling:appointment.cancel', outcome: 'denied', reason: 'NO_MATCHING_ROLE' },
      { action: 'scheduling:appointment.read', outcome: 'denied', reason: 'NO_MATCHING_ROLE' },
    ]);

    expect(await verifyChain(trail.entries)).toEqual({ valid: true, checked: 2 });
  });
});

describe('auditDecisions, the allowed reads', () => {
  it('leaves out an allowed read, unless its permission is sensitive', async () => {
    const { trail, queries } = application();

    await queries.execute(new ListAppointmentsQuery(ada));
    await queries.execute(new ReadMedicalFileQuery(ada, 'patient-9'));

    expect(trail.entries.map(({ action, outcome, resource }) => ({ action, outcome, resource }))).toEqual([
      { action: 'scheduling:medical-file.read', outcome: 'allowed', resource: { type: 'patient', id: 'patient-9' } },
    ]);
  });

  it('tells a read by the bus that carried the message, whatever the message is named', async () => {
    const { trail, commands, queries } = application();

    await queries.execute(new UpcomingAppointments(ada));
    await commands.execute(new SaveSearchQuery(ada));

    expect(trail.entries.map((entry) => entry.action)).toEqual(['scheduling:search.save']);
  });

  it('records an allowed decision that names no kind: it was taken outside a bus, so nothing says it is a read', async () => {
    const trail = new InMemoryAuditTrail();
    const onDecision = auditDecisions(trail, aSource());

    await onDecision({
      actorId: 'ada',
      permissionId: 'scheduling:appointment.read',
      decision: { allowed: true },
      useCase: 'ListAppointmentsQuery',
    });

    expect(trail.entries.map((entry) => entry.outcome)).toEqual(['allowed']);
  });

  it('records every allowed read when asked to', async () => {
    const { trail, queries } = application(new AllowAll(), { allowedReads: 'all' });

    await queries.execute(new ListAppointmentsQuery(ada));

    expect(trail.entries.map((entry) => entry.action)).toEqual(['scheduling:appointment.read']);
  });

  it('records a share of the allowed reads when asked to sample them', async () => {
    const draws = [0.05, 0.5, 0.09, 0.9];

    const { trail, queries } = application(new AllowAll(), {
      allowedReads: { sample: 0.1, random: () => draws.shift() ?? 1 },
    });

    for (let index = 0; index < 4; index += 1) {
      await queries.execute(new ListAppointmentsQuery(ada));
    }

    expect(trail.entries).toHaveLength(2);
  });

  it('takes the word of the application on what a read is', async () => {
    const { trail, commands } = application(new AllowAll(), {
      isRead: (decision) => decision.useCase === 'CancelAppointmentCommand',
    });

    await commands.execute(new CancelAppointmentCommand(ada, 'apt-1'));

    expect(trail.entries).toEqual([]);
  });
});

describe('auditDecisions, who the entry names', () => {
  it('records the impersonation and the session of the work in progress, in the chain of its tenant', async () => {
    const { trail, source, commands } = application();

    const session = {
      id: 'session-4',
      actor: ada,
      issuedAt: NOW,
      authenticationMethod: 'sso',
      impersonatedBy: 'support-7',
      extensions: {},
    } as const;

    source.scope.enter(requestOf(ada, { session }));

    await commands.execute(new CancelAppointmentCommand(ada, 'apt-1'));

    expect(trail.entries[0]).toMatchObject({
      actor: { id: 'ada' },
      impersonatedBy: 'support-7',
      sessionId: 'session-4',
      chain: 'tenant:acme',
    });
  });

  it('names the actor the decision was about when it is not the one of the work in progress', async () => {
    const { trail, source, commands } = application(new DenyAll());

    source.scope.enter(requestOf(support, { tenantId: 'acme' }));

    await expect(commands.execute(new CancelAppointmentCommand(ada, 'apt-1'))).rejects.toThrow(ForbiddenError);

    expect(trail.entries[0]).toMatchObject({
      actor: { id: 'ada', type: 'unknown' },
      tenantId: 'acme',
      outcome: 'denied',
    });
  });
});
