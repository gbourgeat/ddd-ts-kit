import { describe, expect, it } from 'vitest';
import {
  AsyncLocalStorageActorContext,
  AuthorizedCommand,
  AuthorizedQuery,
  Command,
  FixedActorContext,
  InMemoryCommandBus,
  NoCurrentActorError,
  AsyncLocalStorageExecutionScope,
  ScopedActorContext,
  SequentialIdGenerator,
  anonymousActor,
  isActor,
  isActored,
  isAnonymous,
  isAuthenticated,
  isSystem,
  systemActor,
  type Actor,
  type ActorContext,
} from '../src';

const ada: Actor = { id: 'ada', type: 'user', tenantId: 'acme', roles: ['author'], attributes: { team: 'core' } };
const bob: Actor = { id: 'bob', type: 'user', roles: [], attributes: {} };

class RenameArticle extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly title: string,
  ) {
    super(actor);
  }
}

class SearchArticles extends AuthorizedQuery<readonly string[]> {}

class GetCatalog extends Command {}

describe('Actor', () => {
  it('tells an anonymous caller from an authenticated one', () => {
    expect(isAnonymous(anonymousActor())).toBe(true);
    expect(isAuthenticated(anonymousActor())).toBe(false);
    expect(isAuthenticated(ada)).toBe(true);
    expect(anonymousActor()).toEqual({ id: 'anonymous', type: 'anonymous', roles: [], attributes: {} });
  });

  it('names the system acting on its own behalf', () => {
    const job = systemActor('invoice-reminder');

    expect(job).toEqual({ id: 'system:invoice-reminder', type: 'system', roles: [], attributes: {} });
    expect(isSystem(job)).toBe(true);
    expect(isSystem(ada)).toBe(false);
    expect(isAuthenticated(job)).toBe(true);
  });

  it('hands out actors nobody can alter', () => {
    expect(Object.isFrozen(anonymousActor())).toBe(true);
    expect(Object.isFrozen(systemActor('job').roles)).toBe(true);
  });

  it('recognizes an actor among unknown values', () => {
    expect(isActor(ada)).toBe(true);
    expect(isActor({ id: 'ada', type: 'robot', roles: [], attributes: {} })).toBe(false);
    expect(isActor({ id: 'ada', type: 'user' })).toBe(false);
    expect(isActor('ada')).toBe(false);
    expect(isActor(null)).toBe(false);
  });
});

describe('authorized commands and queries', () => {
  it('carry the actor as data of the message', () => {
    const command = new RenameArticle(ada, 'Tuples');

    expect(command.actor).toBe(ada);
    expect(command.title).toBe('Tuples');
    expect(new SearchArticles(bob).actor).toBe(bob);
  });

  it('are told apart from public messages', () => {
    expect(isActored(new RenameArticle(ada, 'Tuples'))).toBe(true);
    expect(isActored(new GetCatalog())).toBe(false);
    expect(isActored({ actor: 'ada' })).toBe(false);
  });

  it('go through the buses like any other message', async () => {
    const bus = new InMemoryCommandBus().register(RenameArticle, {
      execute: async (command) => `${command.actor.id} renamed to ${command.title}`,
    });

    expect(await bus.execute(new RenameArticle(ada, 'Tuples'))).toBe('ada renamed to Tuples');
  });
});

describe.each<[string, () => ActorContext]>([
  ['AsyncLocalStorageActorContext', () => new AsyncLocalStorageActorContext()],
  ['FixedActorContext', () => new FixedActorContext()],
  [
    'ScopedActorContext',
    () => new ScopedActorContext(new AsyncLocalStorageExecutionScope(), new SequentialIdGenerator('corr')),
  ],
])('%s', (_name, create) => {
  it('has no actor outside of run', () => {
    const context = create();

    expect(context.current()).toBeUndefined();
    expect(() => context.require()).toThrow(NoCurrentActorError);
  });

  it('gives the actor to everything run calls, across awaits', async () => {
    const context = create();

    const seen = await context.run(ada, async () => {
      await Promise.resolve();

      return [context.current(), context.require()];
    });

    expect(seen).toEqual([ada, ada]);
    expect(context.current()).toBeUndefined();
  });

  it('restores the outer actor after a nested run', () => {
    const context = create();

    const seen = context.run(ada, () => {
      const inner = context.run(bob, () => context.require().id);

      return [inner, context.require().id];
    });

    expect(seen).toEqual(['bob', 'ada']);
  });

  it('forgets the actor when the work throws', () => {
    const context = create();

    expect(() =>
      context.run(ada, () => {
        throw new RangeError('boom');
      }),
    ).toThrow(RangeError);

    expect(context.current()).toBeUndefined();
  });
});

describe('AsyncLocalStorageActorContext', () => {
  it('keeps concurrent requests apart', async () => {
    const context = new AsyncLocalStorageActorContext();

    const idAfterPause = (actor: Actor, pause: number): Promise<string> =>
      context.run(actor, async () => {
        await new Promise((resolve) => setTimeout(resolve, pause));

        return context.require().id;
      });

    expect(await Promise.all([idAfterPause(ada, 10), idAfterPause(bob, 1)])).toEqual(['ada', 'bob']);
  });
});

describe('FixedActorContext', () => {
  it('answers the actor a test gave it', () => {
    const context = new FixedActorContext(ada);

    expect(context.require()).toBe(ada);
    context.actAs(bob);
    expect(context.current()).toBe(bob);
  });
});
