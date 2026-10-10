import { defineSchema, from, union } from '@ddd-ts-kit/auth/rebac';

/**
 * Who is what to which element. A practice has its members; a desk is the post of one
 * practitioner in one practice (object id `<practiceId>.<practitionerId>`), held by the
 * practitioner, delegated in whole or for the availabilities only, and managed by whoever
 * manages the practice; a calendar belongs to a desk, an appointment to a calendar and to its
 * patient; a person is one user. A bounded context and who operates it stays the resource of
 * the use cases the application runs on its own behalf: a system actor (a scheduled job, an
 * integration event handler) is a subject of type `system`.
 */
export const relationshipSchema = defineSchema({
  user: {},
  system: {},
  context: {
    relations: { operator: ['user', 'system'] },
    permissions: { operate: union('operator') },
  },
  practice: {
    relations: { manager: ['user'], practitioner: ['user'], assistant: ['user'] },
    permissions: { manage: union('manager'), work: union('manager', 'practitioner', 'assistant') },
  },
  desk: {
    relations: { holder: ['user'], delegate: ['user'], availability_delegate: ['user'], practice: ['practice'] },
    permissions: {
      own: union('holder', from('practice', 'manage')),
      run: union('holder', 'delegate', from('practice', 'manage')),
      plan: union('holder', 'availability_delegate', from('practice', 'manage')),
    },
  },
  calendar: {
    relations: { desk: ['desk'], practice: ['practice'] },
    permissions: { plan: from('desk', 'plan'), run: from('desk', 'run'), measure: union(from('desk', 'own')) },
  },
  appointment: {
    relations: { patient: ['user'], calendar: ['calendar'] },
    permissions: {
      read: union('patient', from('calendar', 'run')),
      change: union('patient', from('calendar', 'run')),
      close: from('calendar', 'run'),
    },
  },
  person: {
    relations: { self: ['user'] },
    permissions: { be: union('self') },
  },
});
