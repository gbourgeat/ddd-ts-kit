import { describe, expect, it } from 'vitest';
import {
  AuthorizedCommand,
  FixedClock,
  InMemoryCommandBus,
  err,
  ok,
  unitOfWorkMiddleware,
  type Result,
} from '@ddd-ts-kit/kernel';
import {
  AuthorizationMap,
  ForbiddenError,
  PolicyAccess,
  PolicyDenialIgnoredError,
  PolicyNotAskedError,
  authorizationMiddleware,
  definePolicy,
  policiesAskedMiddleware,
  requires,
} from '../src';
import { AllowAll } from '../src/testing';
import { IssueInvoice, VoidInvoice, ada, billingPermissions, bob } from './support/billing';

interface Invoice {
  readonly id: string;
  readonly issuedBy: string;
}

const onlyIssuerVoids = definePolicy<Invoice>({
  name: 'billing.only-issuer-voids',
  permission: billingPermissions['invoice.void'],
  allows: (actor, invoice) => invoice.issuedBy === actor.id,
});

const map = AuthorizationMap.of(
  requires(IssueInvoice, billingPermissions['invoice.issue']),
  requires(VoidInvoice, billingPermissions['invoice.void']),
);

const invoice: Invoice = { id: 'inv-1', issuedBy: 'ada' };

/** A unit of work that tells what it committed from what it rolled back. */
function ledger() {
  const committed: string[] = [];
  const rolledBack: string[] = [];

  const run = async <T>(work: () => Promise<T>): Promise<T> => {
    try {
      const result = await work();

      committed.push('work');

      return result;
    } catch (error) {
      rolledBack.push('work');
      throw error;
    }
  };

  return { committed, rolledBack, run };
}

type VoidHandler = (command: VoidInvoice, access: PolicyAccess) => Promise<void>;

function application(voids: VoidHandler, answering?: () => Promise<unknown>) {
  const access = new PolicyAccess({ policies: [onlyIssuerVoids], clock: new FixedClock(new Date(0)) });
  const unitOfWork = ledger();

  const commands = new InMemoryCommandBus()
    .use(authorizationMiddleware({ authorizer: new AllowAll(), map }))
    .use(unitOfWorkMiddleware({ run: unitOfWork.run }))
    .aroundHandler(policiesAskedMiddleware({ map, refined: [onlyIssuerVoids.permission] }))
    .register(IssueInvoice, { execute: async (command) => `invoice for ${command.customerId}` })
    .register(VoidInvoice, { execute: (command) => voids(command, access) });

  if (answering !== undefined) {
    commands.use(answering);
  }

  return { commands, unitOfWork };
}

/** A use case whose handler answers a `Result`, the way a project of named refusals writes it. */
class SettleInvoice extends AuthorizedCommand<Result<string, { readonly code: string }>> {}

type SettleHandler = (
  command: SettleInvoice,
  access: PolicyAccess,
) => Promise<Result<string, { readonly code: string }>>;

function settlement(settles: SettleHandler) {
  const access = new PolicyAccess({ policies: [onlyIssuerVoids], clock: new FixedClock(new Date(0)) });
  const settling = AuthorizationMap.of(requires(SettleInvoice, billingPermissions['invoice.void']));

  return new InMemoryCommandBus()
    .use(authorizationMiddleware({ authorizer: new AllowAll(), map: settling }))
    .aroundHandler(policiesAskedMiddleware({ map: settling, refined: [onlyIssuerVoids.permission] }))
    .register(SettleInvoice, { execute: (command) => settles(command, access) });
}

const asking: VoidHandler = (command, access) =>
  access.authorize(command.actor, billingPermissions['invoice.void'], invoice);

describe('policiesAskedMiddleware', () => {
  it('lets through a handler that asks the policy of its permission once it holds the element', async () => {
    const { commands, unitOfWork } = application(asking);

    await commands.execute(new VoidInvoice(ada, 'inv-1'));

    expect(unitOfWork.committed).toEqual(['work']);
  });

  it('answers the refusal of the policy, not a missing question, when the policy says no', async () => {
    const { commands } = application(asking);

    await expect(commands.execute(new VoidInvoice(bob, 'inv-1'))).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('refuses the result of a handler that never asks, and rolls its change back', async () => {
    const { commands, unitOfWork } = application(async () => undefined);

    await expect(commands.execute(new VoidInvoice(ada, 'inv-1'))).rejects.toThrow(PolicyNotAskedError);

    await expect(commands.execute(new VoidInvoice(ada, 'inv-1'))).rejects.toThrow(
      'The command VoidInvoice requires billing:invoice.void, which a policy refines',
    );

    expect(unitOfWork.committed).toEqual([]);
    expect(unitOfWork.rolledBack).toEqual(['work', 'work']);
  });

  it('refuses a handler that goes on with a success when no question on the permission of its use case was allowed, and rolls its change back', async () => {
    const { commands, unitOfWork } = application(async (command, access) => {
      await access.decide(command.actor, billingPermissions['invoice.void'], invoice);
    });

    await expect(commands.execute(new VoidInvoice(bob, 'inv-1'))).rejects.toBeInstanceOf(PolicyDenialIgnoredError);

    await expect(commands.execute(new VoidInvoice(bob, 'inv-1'))).rejects.toThrow(
      'The command VoidInvoice requires billing:invoice.void, which a policy refines, and its handler answered with a success though Access allowed it on no element',
    );

    expect(unitOfWork.committed).toEqual([]);
  });

  it('lets a handler allowed on no element that answers a failed Result give its own refusal', async () => {
    const refusal = err({ code: 'NOT_THE_ISSUER' });

    const settles = settlement(async (command, access) => {
      const decision = await access.decide(command.actor, billingPermissions['invoice.void'], invoice);

      return decision.allowed ? ok('settled') : refusal;
    });

    expect(await settles.execute(new SettleInvoice(bob))).toBe(refusal);
  });

  it('refuses a handler allowed on no element that answers with a successful Result', async () => {
    const settles = settlement(async (command, access) => {
      await access.decide(command.actor, billingPermissions['invoice.void'], invoice);

      return ok('settled');
    });

    await expect(settles.execute(new SettleInvoice(bob))).rejects.toBeInstanceOf(PolicyDenialIgnoredError);
  });

  it('lets through a handler that applies the elements it is allowed on and skips the others, whatever the order of the answers', async () => {
    const ownInvoice: Invoice = { id: 'inv-2', issuedBy: 'bob' };
    const voided: string[] = [];

    const { commands, unitOfWork } = application(async (command, access) => {
      const decisions = await Promise.all(
        [ownInvoice, invoice].map((element) =>
          access.decide(command.actor, billingPermissions['invoice.void'], element),
        ),
      );

      voided.push(...[ownInvoice, invoice].filter((_, index) => decisions[index]?.allowed).map(({ id }) => id));
    });

    await commands.execute(new VoidInvoice(bob, 'inv-2'));

    expect(voided).toEqual(['inv-2']);
    expect(unitOfWork.committed).toEqual(['work']);
  });

  it('counts only the permission of the use case, not another one asked on the way', async () => {
    const { commands } = application(async (command, access) => {
      await access.decide(command.actor, billingPermissions['invoice.read'], invoice);
    });

    await expect(commands.execute(new VoidInvoice(ada, 'inv-1'))).rejects.toBeInstanceOf(PolicyNotAskedError);
  });

  it('leaves alone a middleware that answers in place of the handler, added after it', async () => {
    const { commands } = application(
      async () => undefined,
      async () => 'recorded',
    );

    expect(await commands.execute(new VoidInvoice(ada, 'inv-1'))).toBe('recorded');
  });

  it('leaves alone a use case whose permission no policy refines', async () => {
    const { commands } = application(asking);

    expect(await commands.execute(new IssueInvoice(ada, 'customer-1'))).toBe('invoice for customer-1');
  });

  it('keeps the questions of concurrent messages apart', async () => {
    let release: () => void = () => undefined;

    const held = new Promise<void>((resolve) => {
      release = resolve;
    });

    const { commands } = application(async (command, access) => {
      if (command.invoiceId === 'asks-late') {
        await held;
        await access.authorize(command.actor, billingPermissions['invoice.void'], invoice);
      }
    });

    const late = commands.execute(new VoidInvoice(ada, 'asks-late'));
    const silent = commands.execute(new VoidInvoice(ada, 'never-asks'));

    await expect(silent).rejects.toBeInstanceOf(PolicyNotAskedError);
    release();
    await expect(late).resolves.toBeUndefined();
  });
});
