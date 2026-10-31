import { describe, expect, it, beforeEach } from 'vitest';
import { FixedClock, anonymousActor, type Actor } from '@ddd-ts-kit/kernel';
import {
  PolicyBasedAuthorizer,
  allOf,
  anyOf,
  forbid,
  known,
  not,
  permit,
  type Condition,
  type ResourceAttributes,
  type ResourceAttributeValues,
  type ResourceRef,
} from '../src';
import { authorizerContract } from '../src/testing';
import { billingPermissions } from './support/billing';

const read = billingPermissions['invoice.read'];
const issue = billingPermissions['invoice.issue'];
const voiding = billingPermissions['invoice.void'];

class InMemoryResourceAttributes implements ResourceAttributes {
  readonly asked: ResourceRef[] = [];

  constructor(private readonly known: Readonly<Record<string, ResourceAttributeValues>>) {}

  async of(resource: ResourceRef): Promise<ResourceAttributeValues | undefined> {
    this.asked.push(resource);

    return this.known[`${resource.type}:${resource.id}`];
  }
}

const invoices = () =>
  new InMemoryResourceAttributes({
    'invoice:inv-1': { department: 'sales', amount: 900, status: 'draft' },
    'invoice:inv-2': { department: 'legal', amount: 90_000, status: 'issued' },
  });

const sameDepartment: Condition = ({ actor, attributes }) =>
  actor.attributes['department'] === attributes['department'];

const isManager: Condition = ({ actor }) => actor.attributes['manager'] === true;
const officeHours: Condition = ({ now }) => now.getUTCHours() >= 8 && now.getUTCHours() < 18;
const isLarge: Condition = ({ attributes }) => Number(attributes['amount']) > 10_000;

const policies = [
  permit('invoice.read-own-department', [read], anyOf(sameDepartment, isManager)),
  permit('invoice.issue-in-office-hours', [issue], allOf(sameDepartment, officeHours)),
  permit('invoice.managers-void', ['billing:invoice.void'], isManager),
  forbid(
    'invoice.no-large-void',
    [voiding],
    allOf(
      isLarge,
      not(({ context }) => context['secondApproval'] === true),
    ),
  ),
];

const MORNING = new Date('2026-05-04T09:00:00.000Z');
const salesClerk: Actor = { id: 'ada', type: 'user', roles: [], attributes: { department: 'sales' } };
const legalManager: Actor = { id: 'max', type: 'user', roles: [], attributes: { department: 'legal', manager: true } };
const first = { type: 'invoice', id: 'inv-1' };
const second = { type: 'invoice', id: 'inv-2' };

authorizerContract(
  { describe, it, expect, beforeEach },
  {
    name: 'PolicyBasedAuthorizer',
    create: () => ({
      authorizer: new PolicyBasedAuthorizer({ policies, clock: new FixedClock(MORNING), attributes: invoices() }),
      granted: { actor: salesClerk, permission: read, resource: first },
      refused: { actor: salesClerk, permission: read, resource: second },
    }),
  },
);

describe('PolicyBasedAuthorizer', () => {
  const clock = new FixedClock(MORNING);
  const authorizer = new PolicyBasedAuthorizer({ policies, clock, attributes: invoices() });

  it('applies a policy written without a condition to every request, permit and forbid alike', async () => {
    const unconditional = new PolicyBasedAuthorizer({
      policies: [permit('invoice.anybody-reads', [read]), forbid('invoice.nobody-voids', [voiding])],
      clock,
      attributes: invoices(),
    });

    expect(await unconditional.check({ actor: salesClerk, permission: read, resource: second })).toEqual({
      allowed: true,
    });

    expect((await unconditional.check({ actor: legalManager, permission: voiding, resource: first })).allowed).toBe(
      false,
    );
  });

  it('decides on the attributes of the actor and of the resource', async () => {
    expect(await authorizer.check({ actor: salesClerk, permission: read, resource: first })).toEqual({ allowed: true });

    expect(await authorizer.check({ actor: salesClerk, permission: read, resource: second })).toEqual({
      allowed: false,
      reason: 'NO_MATCHING_POLICY',
    });

    expect(await authorizer.check({ actor: legalManager, permission: read, resource: first })).toEqual({
      allowed: true,
    });
  });

  it('decides on the moment, read from the clock', async () => {
    const timed = new FixedClock(MORNING);
    const atTheDesk = new PolicyBasedAuthorizer({ policies, clock: timed, attributes: invoices() });
    const issuing = { actor: salesClerk, permission: issue, resource: first };

    expect((await atTheDesk.check(issuing)).allowed).toBe(true);
    timed.advance(12 * 3_600_000);
    expect((await atTheDesk.check(issuing)).allowed).toBe(false);
  });

  it('lets an explicit refusal win over every permission', async () => {
    const voidingLarge = { actor: legalManager, permission: voiding, resource: second };

    expect(await authorizer.check({ ...voidingLarge, resource: first })).toEqual({ allowed: true });
    expect(await authorizer.check(voidingLarge)).toEqual({ allowed: false, reason: 'EXPLICIT_DENY' });
  });

  it('decides on the context of the request', async () => {
    const approved = { actor: legalManager, permission: voiding, resource: second, context: { secondApproval: true } };

    expect(await authorizer.check(approved)).toEqual({ allowed: true });
  });

  it('refuses when no policy speaks of the permission', async () => {
    const silent = new PolicyBasedAuthorizer({ policies: [], clock });

    expect(await silent.check({ actor: legalManager, permission: read })).toEqual({
      allowed: false,
      reason: 'NO_MATCHING_POLICY',
    });
  });

  it('refuses the anonymous actor before reading any attribute', async () => {
    const attributes = invoices();
    const open = new PolicyBasedAuthorizer({ policies: [permit('everything', ['*'])], clock, attributes });

    expect(await open.check({ actor: anonymousActor(), permission: read, resource: first })).toEqual({
      allowed: false,
      reason: 'ANONYMOUS',
    });

    expect(attributes.asked).toEqual([]);
  });

  it('gives a rule no attribute for a resource nobody knows, or for no resource', async () => {
    const seen: ResourceAttributeValues[] = [];

    const watching = new PolicyBasedAuthorizer({
      policies: [permit('watch', [read], ({ attributes }) => seen.push(attributes) > 0)],
      clock,
      attributes: invoices(),
    });

    await watching.check({ actor: salesClerk, permission: read, resource: { type: 'invoice', id: 'unknown' } });
    await watching.check({ actor: salesClerk, permission: read });

    expect(seen).toEqual([{}, {}]);
  });

  it('cannot enumerate: a predicate is not a query', () => {
    expect('listAccessible' in authorizer).toBe(false);
  });
});

describe('conditions', () => {
  const yes: Condition = () => true;
  const no: Condition = () => false;
  const input = { actor: salesClerk, permission: read, attributes: {}, context: {}, now: MORNING };

  it('compose with anyOf, allOf and not', () => {
    expect(anyOf(no, yes)(input)).toBe(true);
    expect(anyOf(no, no)(input)).toBe(false);
    expect(allOf(yes, yes)(input)).toBe(true);
    expect(allOf(yes, no)(input)).toBe(false);
    expect(not(no)(input)).toBe(true);
    expect(allOf(anyOf(no, yes), not(no))(input)).toBe(true);
  });
});

describe('rules written over the facts they read', () => {
  const clock = new FixedClock(MORNING);
  const unknown = { type: 'invoice', id: 'inv-new' };
  const clerkOfNoDepartment: Actor = { id: 'eve', type: 'user', roles: [], attributes: {} };

  it('lets an element the port does not hold yet through rules that compare what is missing', async () => {
    const authorizer = new PolicyBasedAuthorizer({ policies, clock, attributes: invoices() });

    expect(await authorizer.check({ actor: legalManager, permission: voiding, resource: unknown })).toEqual({
      allowed: true,
    });

    expect(await authorizer.check({ actor: clerkOfNoDepartment, permission: read, resource: unknown })).toEqual({
      allowed: true,
    });
  });

  it('refuses it once each rule demands its facts: a forbid on what is not known, a permit on what is', async () => {
    const departmentOfBoth: Condition = ({ actor, attributes }) => {
      const department = actor.attributes['department'];

      return department !== undefined && department === attributes['department'];
    };

    const careful = new PolicyBasedAuthorizer({
      policies: [
        permit('invoice.read-own-department', [read], allOf(known('department'), departmentOfBoth)),
        permit('invoice.managers-void', [voiding], isManager),
        forbid('invoice.no-void-of-an-unknown-invoice', [voiding], not(known('amount'))),
        forbid('invoice.no-large-void', [voiding], isLarge),
      ],
      clock,
      attributes: invoices(),
    });

    expect(await careful.check({ actor: legalManager, permission: voiding, resource: unknown })).toEqual({
      allowed: false,
      reason: 'EXPLICIT_DENY',
    });

    expect(await careful.check({ actor: clerkOfNoDepartment, permission: read, resource: unknown })).toEqual({
      allowed: false,
      reason: 'NO_MATCHING_POLICY',
    });

    expect(await careful.check({ actor: legalManager, permission: voiding, resource: first })).toEqual({
      allowed: true,
    });

    expect(await careful.check({ actor: salesClerk, permission: read, resource: first })).toEqual({ allowed: true });
  });
});
