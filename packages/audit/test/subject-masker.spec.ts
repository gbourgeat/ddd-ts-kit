import { describe, expect, it } from 'vitest';
import { InMemoryCommandBus, InMemorySubjectKeyStore } from '@ddd-ts-kit/kernel';
import {
  InMemoryAuditTrail,
  MissingDataSubjectError,
  auditMiddleware,
  auditedFields,
  masked,
  subjectMasker,
  type AuditMasker,
  type AuditedMessage,
  type MaskingSubject,
} from '../src';
import { aSource, ada } from './support/fixtures';
import { aRescheduling } from './support/scheduling/a-rescheduling';
import { RescheduleAppointmentCommand } from './support/scheduling/application/commands/reschedule-appointment.command';

const about = (dataSubject: string): MaskingSubject => ({ field: 'patientEmail', actorId: 'ada', dataSubject });

async function changesRecordedWith(fields: readonly AuditedMessage[], masker: AuditMasker) {
  const trail = new InMemoryAuditTrail();

  const commands = new InMemoryCommandBus()
    .use(auditMiddleware(trail, { ...aSource(), fields, masker }))
    .register(RescheduleAppointmentCommand, { execute: async (command) => command.appointmentId });

  await commands.execute(new RescheduleAppointmentCommand(ada, aRescheduling()));

  return trail.entries[0];
}

describe('subjectMasker, a mask under the key of the data subject', () => {
  it('gives the same mask to equal values of one person, prefixed by the id of their key, and another mask to another person', async () => {
    const keys = new InMemorySubjectKeyStore();
    const masker = subjectMasker(keys);

    const first = await masker.mask('lin@example.org', about('patient-lin'));
    const again = await masker.mask('lin@example.org', about('patient-lin'));
    const other = await masker.mask('lin@example.org', about('patient-bob'));
    const key = await keys.keyFor('patient-lin');

    expect(first).toBe(again);
    expect(first).toMatch(new RegExp(`^${key.id}:[0-9a-f]{64}$`));
    expect(other).not.toBe(first);
    expect(other.startsWith(`${key.id}:`)).toBe(false);
  });

  it('leaves the masks of an erased person impossible to recompute: the key is gone, and a later key gives other masks', async () => {
    const keys = new InMemorySubjectKeyStore();
    const masker = subjectMasker(keys);

    const before = await masker.mask('lin@example.org', about('patient-lin'));
    const keyId = before.slice(0, before.indexOf(':'));

    await keys.erase('patient-lin');

    const after = await masker.mask('lin@example.org', about('patient-lin'));

    expect(await keys.find(keyId)).toBeUndefined();
    expect(after).not.toBe(before);
    expect(after.startsWith(`${keyId}:`)).toBe(false);
  });

  it('derives another masking key under another label, so that the trail never shares a secret with another use of the key', async () => {
    const keys = new InMemorySubjectKeyStore();

    const trail = await subjectMasker(keys).mask('lin@example.org', about('patient-lin'));
    const other = await subjectMasker(keys, { label: 'search-index' }).mask('lin@example.org', about('patient-lin'));

    expect(other).not.toBe(trail);
    expect(other.slice(0, other.indexOf(':'))).toBe(trail.slice(0, trail.indexOf(':')));
  });

  it('refuses a value whose data subject is unknown, since it would have to invent whose key to use', async () => {
    const masker = subjectMasker(new InMemorySubjectKeyStore());

    expect(masker.requiresDataSubject).toBe(true);

    await expect(masker.mask('lin@example.org', { field: 'patientEmail', actorId: 'ada' })).rejects.toThrow(
      MissingDataSubjectError,
    );
  });
});

describe('masked(field, { subject }), whose a masked value is', () => {
  it('names the data subject by a field of the message, which the masker is told and the entry never carries', async () => {
    const keys = new InMemorySubjectKeyStore();

    const fields = [
      auditedFields(RescheduleAppointmentCommand, ['status', masked('patientEmail', { subject: 'patientId' })]),
    ];

    const entry = await changesRecordedWith(fields, subjectMasker(keys));
    const key = await keys.keyFor('patient-lin');

    expect(entry?.changes).toEqual({
      status: 'confirmed',
      patientEmail: { masked: expect.stringMatching(new RegExp(`^${key.id}:[0-9a-f]{64}$`)) },
    });

    expect(JSON.stringify(entry)).not.toContain('lin@example.org');
    expect(JSON.stringify(entry)).not.toContain('patient-lin');
  });

  it('names the data subject by a function of the message too', async () => {
    const seen: MaskingSubject[] = [];

    const recording: AuditMasker = {
      mask: (_value, subject) => {
        seen.push(subject);

        return 'masked';
      },
    };

    const fields = [
      auditedFields(RescheduleAppointmentCommand, [
        masked('patientEmail', { subjectOf: (command: RescheduleAppointmentCommand) => `person:${command.patientId}` }),
      ]),
    ];

    await changesRecordedWith(fields, recording);

    expect(seen).toEqual([
      { field: 'patientEmail', actorId: 'ada', tenantId: 'acme', dataSubject: 'person:patient-lin' },
    ]);
  });

  it('tells the masker no subject when the field named holds no id, and none when the declaration names none', async () => {
    const seen: MaskingSubject[] = [];

    const recording: AuditMasker = {
      mask: (_value, subject) => {
        seen.push(subject);

        return 'masked';
      },
    };

    const fields = [
      auditedFields(RescheduleAppointmentCommand, [masked('patientEmail', { subject: 'startsAt' }), masked('note')]),
    ];

    await changesRecordedWith(fields, recording);

    expect(seen.map((subject) => subject.dataSubject)).toEqual([undefined, undefined]);
  });

  it('is refused at wiring time by a masker keyed per data subject when a masked field names no subject', () => {
    const fields = [auditedFields(RescheduleAppointmentCommand, [masked('patientEmail')])];
    const options = { ...aSource(), fields, masker: subjectMasker(new InMemorySubjectKeyStore()) };

    expect(() => auditMiddleware(new InMemoryAuditTrail(), options)).toThrow(MissingDataSubjectError);
    expect(() => auditMiddleware(new InMemoryAuditTrail(), options)).toThrow('masked("patientEmail", { subject:');
  });

  it('only accepts, as the subject, the name of a field the message has', () => {
    // @ts-expect-error -- 'personId' is not a field of the command
    const declaration = auditedFields(RescheduleAppointmentCommand, [masked('patientEmail', { subject: 'personId' })]);

    expect(declaration.subjectless).toEqual([]);
  });
});
