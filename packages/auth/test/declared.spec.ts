import { describe, expect, it } from 'vitest';
import { anonymousActor } from '@ddd-ts-kit/kernel';
import { contextModule, createTestApplication } from '@ddd-ts-kit/di';
import {
  Access,
  AuthorizationMap,
  AuthorizationSetupError,
  ForbiddenError,
  PolicyNotAskedError,
  RoleBasedAuthorizer,
  UnauthenticatedError,
} from '../src';
import { authorizationModule } from '../src/di';
import { AnybodyAudits } from './fixtures/declared/ledger/application/authorization/anybody-audits.policy';
import { ledgerPermissions } from './fixtures/declared/ledger/application/authorization/ledger.permissions';
import { EntryRepository } from './fixtures/declared/ledger/domain/repositories/entry.repository';
import * as forgetfulDeclared from './fixtures/declared/ledger/forgetful.declarations';
import * as declared from './fixtures/declared/ledger/ledger.declarations';
import { ada, bob } from './support/billing';

const { CountEntries, OnlyPosterReverses, PostEntry, ReverseEntry } = declared;
const { ForgetfulReverseEntry } = forgetfulDeclared;

const ledgerModule = contextModule('ledger', [declared]);

const accountants = () =>
  new RoleBasedAuthorizer({
    roles: {
      accountant: [ledgerPermissions['entry.post'], ledgerPermissions['entry.reverse']],
      clerk: [ledgerPermissions['entry.reverse']],
    },
  });

const application = () =>
  createTestApplication({
    modules: [ledgerModule, authorizationModule({ authorizer: accountants() })],
    authorization: 'required',
  });

const forgetful = (policiesAsked?: boolean) =>
  createTestApplication({
    modules: [
      contextModule('ledger', [declared, forgetfulDeclared]),
      authorizationModule({ authorizer: accountants(), ...(policiesAsked === undefined ? {} : { policiesAsked }) }),
    ],
    authorization: 'required',
  });

describe('a context whose classes declare their access', () => {
  it('is enforced by the authorization module: the permission of the message, deny by default', async () => {
    const app = application();

    expect(await app.commandBus.execute(new PostEntry(ada, 'cash'))).toBe('entry-1');
    await expect(app.commandBus.execute(new PostEntry(bob, 'cash'))).rejects.toBeInstanceOf(ForbiddenError);

    await expect(app.commandBus.execute(new PostEntry(anonymousActor(), 'cash'))).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );

    expect(await app.queryBus.execute(new CountEntries())).toBe(1);
  });

  it('feeds the authorization map, for documentation and administration screens', () => {
    const declarations = application().get(AuthorizationMap).declarations();

    expect(declarations.map((declaration) => [declaration.type.name, declaration.access])).toEqual([
      ['PostEntry', 'protected'],
      ['ReverseEntry', 'protected'],
      ['CountEntries', 'public'],
    ]);
  });

  it('has its declared policy evaluated by the access its handler depends on', async () => {
    const app = application();
    const entryId = await app.commandBus.execute(new PostEntry(ada, 'cash'));

    await expect(app.commandBus.execute(new ReverseEntry(bob, entryId))).rejects.toMatchObject({
      code: 'FORBIDDEN',
      reason: 'ledger.only-poster-reverses',
    });

    await app.commandBus.execute(new ReverseEntry(ada, entryId));

    expect(await app.get(EntryRepository).count()).toBe(0);
  });

  it('builds a declared policy once, when a decision first needs it', async () => {
    const built = OnlyPosterReverses.built;
    const app = application();
    const entry = { id: 'entry-1', account: 'cash', postedBy: 'ada' };

    expect(OnlyPosterReverses.built).toBe(built);
    const access = app.get(Access);

    expect(await access.decide(ada, ledgerPermissions['entry.reverse'], entry)).toEqual({ allowed: true });
    expect(await access.decide(bob, ledgerPermissions['entry.reverse'], entry)).toMatchObject({ allowed: false });

    expect(await access.decide(ada, ledgerPermissions['entry.reverse'], 'not an entry')).toMatchObject({
      allowed: false,
    });

    expect(OnlyPosterReverses.built).toBe(built + 1);
  });

  it('refuses the result of a handler that never asks the policy of its permission', async () => {
    const app = forgetful();
    const entryId = await app.commandBus.execute(new PostEntry(ada, 'cash'));

    await expect(app.commandBus.execute(new ForgetfulReverseEntry(bob, entryId))).rejects.toBeInstanceOf(
      PolicyNotAskedError,
    );
  });

  it('lets a project whose own Access records nothing turn the check off', async () => {
    const app = forgetful(false);
    const entryId = await app.commandBus.execute(new PostEntry(ada, 'cash'));

    await app.commandBus.execute(new ForgetfulReverseEntry(bob, entryId));

    expect(await app.get(EntryRepository).count()).toBe(0);
  });

  it('refuses a policy declared for something that is not a permission', () => {
    const app = createTestApplication({
      modules: [contextModule('ledger', [AnybodyAudits]), authorizationModule({ authorizer: accountants() })],
    });

    expect(() => app.get(Access)).toThrow(AuthorizationSetupError);
    expect(() => app.get(Access)).toThrow('Module "ledger" declares the policy "ledger.anybody-audits"');
  });
});
