import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { InMemoryCommandBus } from '@ddd-ts-kit/kernel';
import {
  InMemoryAuditTrail,
  MissingMaskerError,
  auditMiddleware,
  auditedFields,
  auditedProjection,
  hmacMasker,
  masked,
  type AuditMasker,
  type AuditedMessage,
  type MaskingSubject,
} from '../src';
import { aSource, ada } from './support/fixtures';
import { aRescheduling } from './support/scheduling/a-rescheduling';
import { CancelAppointmentCommand } from './support/scheduling/application/commands/cancel-appointment.command';
import { RescheduleAppointmentCommand } from './support/scheduling/application/commands/reschedule-appointment.command';

async function changesRecordedWith(fields: readonly AuditedMessage[], masker?: AuditMasker) {
  const trail = new InMemoryAuditTrail();

  const commands = new InMemoryCommandBus()
    .use(auditMiddleware(trail, { ...aSource(), fields, ...(masker === undefined ? {} : { masker }) }))
    .register(RescheduleAppointmentCommand, { execute: async (command) => command.appointmentId })
    .register(CancelAppointmentCommand, { execute: async () => undefined });

  await commands.execute(new RescheduleAppointmentCommand(ada, aRescheduling()));

  return trail.entries[0];
}

describe('redaction', () => {
  it('carries no payload at all for a message nobody declared', async () => {
    const entry = await changesRecordedWith([]);

    expect(entry).toMatchObject({ category: 'command', action: 'RescheduleAppointmentCommand', outcome: 'succeeded' });
    expect(entry).not.toHaveProperty('changes');
    expect(JSON.stringify(entry)).not.toContain('lin@example.org');
    expect(JSON.stringify(entry)).not.toContain('family matter');
  });

  it('keeps the declared fields and nothing else, a date as an ISO instant', async () => {
    const entry = await changesRecordedWith([auditedFields(RescheduleAppointmentCommand, ['status', 'startsAt'])]);

    expect(entry?.changes).toEqual({ status: 'confirmed', startsAt: '2026-03-04T09:30:00.000Z' });
  });

  it('stores a masked field as a keyed hash: equal values give equal masks, and the value is not there', async () => {
    const fields = [auditedFields(RescheduleAppointmentCommand, ['status', masked('patientEmail')])];
    const entry = await changesRecordedWith(fields, hmacMasker('a-secret-of-the-platform', { keyId: 'k1' }));

    const expected = createHmac('sha256', 'a-secret-of-the-platform').update('"lin@example.org"', 'utf8').digest('hex');

    expect(entry?.changes).toEqual({ status: 'confirmed', patientEmail: { masked: `k1:${expected}` } });
    expect(JSON.stringify(entry)).not.toContain('lin@example.org');
  });

  it('gives another mask under another secret, so a destroyed secret leaves nothing to compare', async () => {
    const one = await hmacMasker('secret-one').mask('lin@example.org', { field: 'patientEmail', actorId: 'ada' });
    const other = await hmacMasker('secret-two').mask('lin@example.org', { field: 'patientEmail', actorId: 'ada' });

    expect(one).toMatch(/^[0-9a-f]{64}$/);
    expect(other).not.toBe(one);
  });

  it('tells the masker whom the entry is about, so that a key can be chosen per tenant or per person', async () => {
    const subjects: MaskingSubject[] = [];

    const perTenant: AuditMasker = {
      mask: async (value, subject) => {
        subjects.push(subject);

        return `${subject.tenantId ?? 'none'}:${String(value).length}`;
      },
    };

    const fields = [
      auditedFields(RescheduleAppointmentCommand, [masked('patientEmail')], {
        resource: (command) => ({ type: 'appointment', id: command.appointmentId }),
        context: 'scheduling',
      }),
    ];

    const entry = await changesRecordedWith(fields, perTenant);

    expect(subjects).toEqual([
      { field: 'patientEmail', actorId: 'ada', tenantId: 'acme', resource: { type: 'appointment', id: 'apt-1' } },
    ]);

    expect(entry).toMatchObject({
      resource: { type: 'appointment', id: 'apt-1' },
      context: 'scheduling',
      changes: { patientEmail: { masked: 'acme:15' } },
    });
  });

  it('refuses at wiring time a masked field without a masker', () => {
    const fields = [auditedFields(RescheduleAppointmentCommand, [masked('patientEmail')])];

    expect(() => auditMiddleware(new InMemoryAuditTrail(), { ...aSource(), fields })).toThrow(MissingMaskerError);
  });

  it('lets a projector pick values that are not fields of the message, and never stores an object whole', async () => {
    const fields = [
      auditedProjection(RescheduleAppointmentCommand, (command) => ({
        plain: {
          day: command.startsAt.toISOString().slice(0, 10),
          whole: command,
          attempts: 2n,
          retries: 3,
          ratio: Number.NaN,
          nothing: undefined,
        },
        resource: { type: 'appointment', id: command.appointmentId },
      })),
    ];

    const entry = await changesRecordedWith(fields);

    expect(entry?.changes).toEqual({ day: '2026-03-04', attempts: '2', retries: 3 });
    expect(entry?.resource).toEqual({ type: 'appointment', id: 'apt-1' });
  });

  it('refuses at run time a projection that masks a value when no masker is wired', async () => {
    const fields = [
      auditedProjection(RescheduleAppointmentCommand, (command) => ({
        masked: { patientEmail: command.patientEmail },
        resource: { type: 'appointment', id: command.appointmentId },
      })),
    ];

    await expect(changesRecordedWith(fields)).rejects.toBeInstanceOf(MissingMaskerError);
  });

  it('only accepts the names of fields the message has', () => {
    // @ts-expect-error -- 'price' is not a field of the command
    const declaration = auditedFields(RescheduleAppointmentCommand, ['price']);

    expect(declaration.masks).toBe(false);
  });
});
