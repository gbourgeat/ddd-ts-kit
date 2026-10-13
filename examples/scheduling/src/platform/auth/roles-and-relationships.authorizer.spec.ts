import { DenialReason, type Permission } from '@ddd-ts-kit/auth';
import {
  InMemoryRelationTupleStore,
  RelationBasedAuthorizer,
  SchemaCheckedTupleStore,
  type RelationTuple,
} from '@ddd-ts-kit/auth/rebac';
import { anActor } from '@ddd-ts-kit/auth/testing';
import { anonymousActor, systemActor } from '@ddd-ts-kit/kernel';
import { beforeEach, describe, expect, it } from 'vitest';
import { relationshipSchema } from '@/platform/auth/relationship-schema';
import { resourcePermissions } from '@/platform/auth/resource-permissions';
import { roleGrants } from '@/platform/auth/role-grants';
import { RolesAndRelationshipsAuthorizer } from '@/platform/auth/roles-and-relationships.authorizer';

const book = permission('scheduling:appointment.book');
const browse = permission('scheduling:calendar.browse');
const readNotifications = permission('notification:notification.read');
const openPractice = permission('identity:practice.open');
const readTrail = permission('audit:trail.read');

const calendar = { type: 'calendar', id: 'cal-1' };
const deskOfTheCalendar: RelationTuple = { object: 'calendar:cal-1', relation: 'desk', subject: 'desk:practice-1.doc' };
const docHoldsTheDesk: RelationTuple = { object: 'desk:practice-1.doc', relation: 'holder', subject: 'user:doc' };

const doc = anActor().named('doc').build();
const patient = anActor().named('pat').withRole('patient').build();
const admin = anActor().named('root').withRole('network-admin').build();
const staff = anActor().named('ops').withRole('platform-admin').build();
const support = anActor().named('sam').withRole('support').build();

let store: SchemaCheckedTupleStore;
let authorizer: RolesAndRelationshipsAuthorizer;

beforeEach(() => {
  store = new SchemaCheckedTupleStore(relationshipSchema, new InMemoryRelationTupleStore());

  authorizer = new RolesAndRelationshipsAuthorizer(
    new RelationBasedAuthorizer({ schema: relationshipSchema, store, mapping: resourcePermissions }),
    roleGrants,
  );
});

describe('The authorizer of roles and relationships, deciding on the roles of the token', () => {
  describe('the anonymous actor', () => {
    it('is refused, even what every user is granted', async () => {
      expect(await authorizer.check({ actor: anonymousActor(), permission: browse })).toEqual({
        allowed: false,
        reason: DenialReason.anonymous,
      });
    });

    it('lists nothing', async () => {
      expect(
        await authorizer.listAccessible({ actor: anonymousActor(), permission: readTrail, resourceType: 'context' }),
      ).toEqual({ kind: 'none' });
    });
  });

  describe('a role of the token', () => {
    it('grants its permissions without any element', async () => {
      expect(await authorizer.check({ actor: admin, permission: openPractice })).toEqual({ allowed: true });
    });

    it('is missing, by a stable code, when nothing else could grant the permission', async () => {
      expect(await authorizer.check({ actor: doc, permission: openPractice })).toEqual({
        allowed: false,
        reason: DenialReason.noMatchingRole,
      });
    });

    it('grants every authenticated user what needs no role', async () => {
      expect(await authorizer.check({ actor: support, permission: browse })).toEqual({ allowed: true });
    });

    it('grants nothing to a service or a system actor', async () => {
      const service = anActor().named('billing').asService().build();

      expect(await authorizer.check({ actor: service, permission: browse })).toEqual({
        allowed: false,
        reason: DenialReason.noMatchingRole,
      });

      expect(await authorizer.check({ actor: systemActor('scheduling.job'), permission: browse })).toEqual({
        allowed: false,
        reason: DenialReason.noMatchingRole,
      });
    });
  });

  describe('a grant under condition', () => {
    it('holds when the use case states the patient acts for themselves', async () => {
      expect(
        await authorizer.check({
          actor: patient,
          permission: book,
          resource: calendar,
          context: { selfService: true },
        }),
      ).toEqual({ allowed: true });
    });

    it('does not hold without that fact: the relationships decide', async () => {
      expect(await authorizer.check({ actor: patient, permission: book, resource: calendar })).toEqual({
        allowed: false,
        reason: DenialReason.noRelation,
      });

      expect(
        await authorizer.check({
          actor: patient,
          permission: book,
          resource: calendar,
          context: { selfService: false },
        }),
      ).toEqual({ allowed: false, reason: DenialReason.noRelation });
    });

    it('is not given to who lacks the role, whatever the use case states', async () => {
      expect(
        await authorizer.check({ actor: doc, permission: book, resource: calendar, context: { selfService: true } }),
      ).toEqual({ allowed: false, reason: DenialReason.noRelation });
    });
  });
});

describe('The authorizer of roles and relationships, deciding on the relationships', () => {
  describe('without a role that grants', () => {
    beforeEach(() => store.write([deskOfTheCalendar, docHoldsTheDesk]));

    it('allows who the relationships lead to', async () => {
      expect(await authorizer.check({ actor: doc, permission: book, resource: calendar })).toEqual({ allowed: true });
    });

    it('refuses who they do not lead to', async () => {
      expect(await authorizer.check({ actor: support, permission: book, resource: calendar })).toEqual({
        allowed: false,
        reason: DenialReason.noRelation,
      });
    });
  });

  describe('listing', () => {
    it('answers everything to a role whose grant says so', async () => {
      expect(await authorizer.listAccessible({ actor: staff, permission: readTrail, resourceType: 'context' })).toEqual(
        { kind: 'all' },
      );
    });

    it('leaves the scope to the relationships when the grant only opens the use case', async () => {
      await store.write([{ object: 'person:doc', relation: 'self', subject: 'user:doc' }]);

      expect(await authorizer.check({ actor: doc, permission: readNotifications })).toEqual({ allowed: true });

      expect(
        await authorizer.listAccessible({ actor: doc, permission: readNotifications, resourceType: 'person' }),
      ).toEqual({ kind: 'ids', ids: ['doc'] });
    });

    it('never answers everything from a grant under condition', async () => {
      await store.write([deskOfTheCalendar, docHoldsTheDesk]);

      expect(await authorizer.listAccessible({ actor: patient, permission: book, resourceType: 'calendar' })).toEqual({
        kind: 'ids',
        ids: [],
      });

      expect(await authorizer.listAccessible({ actor: doc, permission: book, resourceType: 'calendar' })).toEqual({
        kind: 'ids',
        ids: ['cal-1'],
      });
    });
  });

  describe('a system actor', () => {
    const handler = systemActor('scheduling.on-practice-member-removed');

    it('operates its own context without a stored relationship', async () => {
      expect(
        await authorizer.check({ actor: handler, permission: book, resource: { type: 'context', id: 'scheduling' } }),
      ).toEqual({ allowed: true });
    });

    it('does not operate another context, nor use the permission of another one on its own', async () => {
      expect(
        (
          await authorizer.check({
            actor: handler,
            permission: openPractice,
            resource: { type: 'context', id: 'identity' },
          })
        ).allowed,
      ).toBe(false);

      expect(
        (
          await authorizer.check({
            actor: handler,
            permission: openPractice,
            resource: { type: 'context', id: 'scheduling' },
          })
        ).allowed,
      ).toBe(false);
    });

    it('is nobody on an element', async () => {
      expect(await authorizer.check({ actor: handler, permission: book, resource: calendar })).toEqual({
        allowed: false,
        reason: DenialReason.noRelation,
      });
    });
  });
});

function permission(id: string): Permission {
  const [context = '', name = ''] = id.split(':');

  return { id, context, name, description: id };
}
