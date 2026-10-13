import { describe, expect, it } from 'vitest';
import { FixedClock, anonymousActor } from '@ddd-ts-kit/kernel';
import {
  PolicyAccess,
  AuthorizationSetupError,
  ForbiddenError,
  ListingNotSupportedError,
  RoleBasedAuthorizer,
  UnauthenticatedError,
  definePolicy,
  isResourceRef,
  type DecisionRecord,
} from '../src/index.js';
import { AllowAll, DenyAll, RecordingAuthorizer } from '../src/testing.js';
import { Article, author, onlyAuthorEditsDraft, publishingPermissions, reader } from './support/articles.js';

const NOON = new Date('2026-05-01T12:00:00.000Z');
const edit = publishingPermissions['article.edit'];
const read = publishingPermissions['article.read'];
const draft = new Article('article-1', 'ada');
const scheduled = new Article('article-2', 'ada', new Date('2026-05-02T00:00:00.000Z'));
const published = new Article('article-3', 'ada', new Date('2026-04-01T00:00:00.000Z'));

describe('a policy', () => {
  it('is a named rule over the actor, the loaded element and the moment', () => {
    const context = { now: NOON };

    expect(onlyAuthorEditsDraft.allows(author, draft, context)).toBe(true);
    expect(onlyAuthorEditsDraft.allows(reader, draft, context)).toBe(false);
    expect(onlyAuthorEditsDraft.allows(author, scheduled, context)).toBe(true);
    expect(onlyAuthorEditsDraft.allows(author, published, context)).toBe(false);
  });

  it('must carry a name fit to be a reason code', () => {
    const unnamed = { permission: edit, allows: () => true };

    expect(() => definePolicy({ ...unnamed, name: 'Only the author!' })).toThrow(AuthorizationSetupError);
  });
});

describe('PolicyAccess with policies', () => {
  const access = new PolicyAccess({ policies: [onlyAuthorEditsDraft], clock: new FixedClock(NOON) });

  it('lets the handler go on when the policy allows', async () => {
    await expect(access.authorize(author, edit, draft)).resolves.toBeUndefined();
  });

  it('refuses with the name of the policy as the reason', async () => {
    const refusal = await access.authorize(reader, edit, draft).catch((error: unknown) => error);

    expect(refusal).toBeInstanceOf(ForbiddenError);

    expect(refusal).toMatchObject({
      code: 'FORBIDDEN',
      permissionId: 'publishing:article.edit',
      reason: 'article.only-author-edits-draft',
    });
  });

  it('reads the time from the clock', async () => {
    const clock = new FixedClock(NOON);
    const timed = new PolicyAccess({ policies: [onlyAuthorEditsDraft], clock });

    expect(await timed.decide(author, edit, scheduled)).toEqual({ allowed: true });
    clock.advance(24 * 3_600_000);

    expect(await timed.decide(author, edit, scheduled)).toEqual({
      allowed: false,
      reason: 'article.only-author-edits-draft',
    });
  });

  it('refuses a subject the policy is not about', async () => {
    expect(await access.decide(author, edit, { id: 'article-1', authorId: 'ada' })).toEqual({
      allowed: false,
      reason: 'SUBJECT_MISMATCH',
    });
  });

  it('refuses a permission no policy and no authorizer answers for', async () => {
    expect(await access.decide(author, read, draft)).toEqual({ allowed: false, reason: 'NO_POLICY' });
  });

  it('lets a policy give its own reason', async () => {
    const frozen = definePolicy<Article>({
      name: 'article.not-during-freeze',
      permission: edit,
      allows: () => ({ allowed: false, reason: 'EDITORIAL_FREEZE' }),
    });

    const freezing = new PolicyAccess({ policies: [onlyAuthorEditsDraft, frozen], clock: new FixedClock(NOON) });

    expect(await freezing.decide(author, edit, draft)).toEqual({ allowed: false, reason: 'EDITORIAL_FREEZE' });

    expect(await freezing.decide(reader, edit, draft)).toEqual({
      allowed: false,
      reason: 'article.only-author-edits-draft',
    });
  });

  it('answers the anonymous actor with a 401 error', async () => {
    await expect(access.authorize(anonymousActor(), edit, draft)).rejects.toBeInstanceOf(UnauthenticatedError);
  });
});

describe('PolicyAccess with an authorizer', () => {
  it('asks the authorizer once the policies allow, about the resource the subject stands for', async () => {
    const authorizer = new RecordingAuthorizer();

    const access = new PolicyAccess({
      authorizer,
      policies: [onlyAuthorEditsDraft],
      clock: new FixedClock(NOON),
      resourceOf: (subject) => (subject instanceof Article ? { type: 'article', id: subject.id } : undefined),
    });

    await access.authorize(author, edit, draft);
    await access.authorize(reader, edit, draft).catch(() => undefined);

    expect(authorizer.checks).toEqual([
      { actor: author, permission: edit, resource: { type: 'article', id: 'article-1' }, context: { subject: draft } },
    ]);
  });

  it('refuses when the authorizer refuses, whatever the policies say', async () => {
    const access = new PolicyAccess({
      authorizer: new DenyAll('NO_MATCHING_ROLE'),
      policies: [onlyAuthorEditsDraft],
      clock: new FixedClock(NOON),
    });

    expect(await access.decide(author, edit, draft)).toEqual({ allowed: false, reason: 'NO_MATCHING_ROLE' });
  });

  it('takes a plain resource reference as its own resource, never an aggregate that looks like one', async () => {
    const authorizer = new RecordingAuthorizer();
    const access = new PolicyAccess({ authorizer, clock: new FixedClock(NOON) });

    await access.authorize(author, read, { type: 'article', id: 'article-9' });
    await access.authorize(author, read, { type: 'article', id: 'article-9', title: 'Tuples' });

    expect(authorizer.checks.map((check) => check.resource)).toEqual([{ type: 'article', id: 'article-9' }, undefined]);
    expect(isResourceRef(draft)).toBe(false);
  });

  it('reports every decision to the audit hook', async () => {
    const audit: DecisionRecord[] = [];

    const access = new PolicyAccess({
      policies: [onlyAuthorEditsDraft],
      clock: new FixedClock(NOON),
      onDecision: (record) => void audit.push(record),
    });

    await access.decide(author, edit, draft);
    await access.decide(reader, edit, draft);

    expect(audit).toEqual([
      { actorId: 'ada', permissionId: 'publishing:article.edit', decision: { allowed: true } },
      {
        actorId: 'bob',
        permissionId: 'publishing:article.edit',
        decision: { allowed: false, reason: 'article.only-author-edits-draft' },
      },
    ]);
  });
});

describe('PolicyAccess asked a question', () => {
  it('gives the authorizer the context of the question, and records the decision unless told not to', async () => {
    const audit: DecisionRecord[] = [];
    const authorizer = new RecordingAuthorizer();

    const access = new PolicyAccess({
      authorizer,
      clock: new FixedClock(NOON),
      onDecision: (record) => void audit.push(record),
    });

    const article = { type: 'article', id: 'article-9' };

    await access.decideOn({ actor: author, permission: read, subject: article, context: { selfService: true } });
    await access.decideOn({ actor: author, permission: read, subject: article, recorded: false });

    expect(authorizer.checks.map((check) => check.context)).toEqual([
      { selfService: true, subject: article },
      { subject: article },
    ]);

    expect(audit).toHaveLength(1);
  });
});

describe('PolicyAccess.scope', () => {
  const clock = new FixedClock(NOON);

  it('gives the scope the authorizer computes, to hand to a read port', async () => {
    const authorizer = new RoleBasedAuthorizer({ roles: { writer: [read] } });
    const access = new PolicyAccess({ authorizer, clock });

    expect(await access.scope(author, read, 'article')).toEqual({ kind: 'all' });
    expect(await access.scope(author, edit, 'article')).toEqual({ kind: 'none' });
  });

  it('gives nothing to the anonymous actor', async () => {
    expect(
      await new PolicyAccess({ authorizer: new AllowAll(), clock }).scope(anonymousActor(), read, 'article'),
    ).toEqual({
      kind: 'none',
    });
  });

  it('fails loudly when the model cannot enumerate, instead of guessing', async () => {
    const access = new PolicyAccess({ authorizer: { check: async () => ({ allowed: true }) }, clock });

    await expect(access.scope(author, read, 'article')).rejects.toBeInstanceOf(ListingNotSupportedError);
  });
});
