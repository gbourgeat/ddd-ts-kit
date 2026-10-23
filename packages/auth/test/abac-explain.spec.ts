import { describe, expect, it } from 'vitest';
import { FixedClock, anonymousActor, type Actor } from '@ddd-ts-kit/kernel';
import {
  PolicyBasedAuthorizer,
  forbid,
  permit,
  traceText,
  type Condition,
  type ResourceAttributes,
  type ResourceAttributeValues,
  type ResourceRef,
} from '../src';
import { billingPermissions } from './support/billing';

const read = billingPermissions['invoice.read'];
const voiding = billingPermissions['invoice.void'];

const sameDepartment: Condition = ({ actor, attributes }) =>
  actor.attributes['department'] === attributes['department'];

const isManager: Condition = ({ actor }) => actor.attributes['manager'] === true;
const isLarge: Condition = ({ attributes }) => Number(attributes['amount']) > 10_000;

const policies = [
  permit('invoice.read-own-department', [read], sameDepartment),
  permit('invoice.managers-void', [voiding], isManager),
  permit('billing.managers-do-everything', ['billing:*'], isManager),
  forbid('invoice.no-large-void', [voiding], isLarge),
];

const invoices: ResourceAttributes = {
  of: async (resource: ResourceRef): Promise<ResourceAttributeValues | undefined> =>
    resource.id === 'inv-2' ? { department: 'legal', amount: 90_000 } : undefined,
};

const salesClerk: Actor = { id: 'ada', type: 'user', roles: [], attributes: { department: 'sales' } };
const legalManager: Actor = { id: 'max', type: 'user', roles: [], attributes: { department: 'legal', manager: true } };
const second = { type: 'invoice', id: 'inv-2' };

const authorizer = new PolicyBasedAuthorizer({ policies, clock: new FixedClock(new Date(0)), attributes: invoices });

describe('PolicyBasedAuthorizer.explain', () => {
  it('names what is known of the element, then each policy that bears on the permission and whether it holds', async () => {
    const { decision, trace } = await authorizer.explain({
      actor: legalManager,
      permission: voiding,
      resource: second,
    });

    expect(decision).toEqual({ allowed: false, reason: 'EXPLICIT_DENY' });

    expect(traceText(trace)).toBe(
      [
        '  invoice:inv-2 is known by department, amount',
        '  permit invoice.managers-void holds',
        '  permit billing.managers-do-everything (billing:*) holds',
        '  forbid invoice.no-large-void holds, and refuses',
      ].join('\n'),
    );
  });

  it('says which policy did not hold when none permits', async () => {
    const { decision, trace } = await authorizer.explain({ actor: salesClerk, permission: read, resource: second });

    expect(decision).toEqual({ allowed: false, reason: 'NO_MATCHING_POLICY' });

    expect(traceText(trace)).toBe(
      [
        '  invoice:inv-2 is known by department, amount',
        'x permit invoice.read-own-department does not hold',
        'x permit billing.managers-do-everything (billing:*) does not hold',
      ].join('\n'),
    );
  });

  it('says when nothing is known of the element, and when no policy bears on the permission', async () => {
    const unknown = await authorizer.explain({
      actor: salesClerk,
      permission: read,
      resource: { type: 'invoice', id: '?' },
    });

    expect(traceText(unknown.trace)).toContain('x nothing is known of invoice:?');

    const silent = new PolicyBasedAuthorizer({ policies: [], clock: new FixedClock(new Date(0)) });

    expect(await silent.explain({ actor: salesClerk, permission: read })).toEqual({
      decision: { allowed: false, reason: 'NO_MATCHING_POLICY' },
      trace: [{ depth: 0, text: 'no policy bears on billing:invoice.read', answer: 'no' }],
    });
  });

  it('refuses the anonymous actor without a word', async () => {
    expect(await authorizer.explain({ actor: anonymousActor(), permission: read, resource: second })).toEqual({
      decision: { allowed: false, reason: 'ANONYMOUS' },
      trace: [],
    });
  });
});
