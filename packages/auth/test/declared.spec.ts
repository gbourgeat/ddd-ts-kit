import { describe, expect, it } from 'vitest';
import { anonymousActor } from '@ddd-ts-kit/kernel';
import { contextModule, createTestApplication } from '@ddd-ts-kit/di';
import {
  Access,
  AuthorizationMap,
  AuthorizationSetupError,
  ForbiddenError,
  RoleBasedAuthorizer,
  UnauthenticatedError,
} from '../src/index.js';
import { authorizationModule } from '../src/di.js';
import { AnybodyAudits } from './fixtures/declared/ledger/application/authorization/anybody-audits.policy.js';
import { ledgerPermissions } from './fixtures/declared/ledger/application/authorization/ledger.permissions.js';
import { EntryRepository } from './fixtures/declared/ledger/domain/repositories/entry.repository.js';
import * as declared from './fixtures/declared/ledger/ledger.declarations.js';
import { ada, bob } from './support/billing.js';

const { CountEntries, OnlyPosterReverses, PostEntry, ReverseEntry } = declared;

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

  it('refuses a policy declared for something that is not a permission', () => {
    const app = createTestApplication({
      modules: [contextModule('ledger', [AnybodyAudits]), authorizationModule({ authorizer: accountants() })],
    });

    expect(() => app.get(Access)).toThrow(AuthorizationSetupError);
    expect(() => app.get(Access)).toThrow('Module "ledger" declares the policy "ledger.anybody-audits"');
  });
});
