import type { DomainEventDispatcher } from '../../application/ports/domain-event-dispatcher';
import { announceDomainEvents } from './announce-domain-events';
import { recordedAggregates } from './recorded-aggregates';
import { SaveAfterCommitError } from './save-after-commit-error';
import { unitOfWorkScope } from './unit-of-work-scope';

type Method = (this: unknown, ...args: unknown[]) => unknown;

type Dispatching = () => Pick<DomainEventDispatcher, 'dispatch'>;

const wrapped = new WeakSet<object>();

/**
 * Makes domain events leave with the save. Every method of the repository that is handed an
 * aggregate (`save(order)`, `saveAll([a, b])`, `remove(order)`) and resolves has the events
 * those aggregates recorded pulled, in the order of the arguments then of recording, and handed
 * to `announceDomainEvents`: queued until the end of the unit of work in progress, or dispatched
 * before the caller gets its answer when there is none. A call that fails pulls nothing: the
 * events stay on the aggregate and reach no handler. A method that is handed no aggregate
 * (`findById`, `remove(id)`) is untouched. Called by an `after-commit` handler with an
 * aggregate, a method is refused before it writes (`SaveAfterCommitError`).
 *
 * The repository is wrapped in place, as tracing and the aspects do, so the same object is
 * answered and wrapping twice is a no-op; a sealed or frozen one is fronted by a proxy. The
 * dispatcher is asked for at each dispatch. An adapter contains no dispatch code: one that
 * pulls the events itself leaves nothing to dispatch here.
 */
export function dispatchingOnSave<T extends object>(repository: T, dispatcher: Dispatching): T {
  if (wrapped.has(repository)) {
    return repository;
  }

  const wrappers = new Map<string, Method>();

  for (const [name, method] of methodsOf(repository)) {
    wrappers.set(name, announcing(method, dispatcher));
  }

  const result = Object.isExtensible(repository) ? shadowed(repository, wrappers) : proxied(repository, wrappers);

  wrapped.add(result);

  return result;
}

/** Own and inherited methods as they are reached now: a wrapper put by an aspect is the method. */
function methodsOf(instance: object): Map<string, Method> {
  const methods = new Map<string, Method>();

  for (
    let owner: object | null = instance;
    owner !== null && owner !== Object.prototype;
    owner = Reflect.getPrototypeOf(owner)
  ) {
    for (const name of Object.getOwnPropertyNames(owner)) {
      const descriptor = Object.getOwnPropertyDescriptor(owner, name);

      if (name === 'constructor' || methods.has(name) || typeof descriptor?.value !== 'function') {
        continue;
      }

      const current: unknown = Reflect.get(instance, name);

      if (isMethod(current)) {
        methods.set(name, current);
      }
    }
  }

  return methods;
}

function isMethod(value: unknown): value is Method {
  return typeof value === 'function' && !Function.prototype.toString.call(value).startsWith('class');
}

/** Async when the method is declared so, for what reads it later (tracing, an aspect) to see an asynchronous method. */
function announcing(original: Method, dispatcher: Dispatching): Method {
  const announced = async (args: readonly unknown[], result: unknown): Promise<unknown> => {
    const value = await result;

    await announceDomainEvents(
      recordedAggregates(args).flatMap((aggregate) => aggregate.pullEvents()),
      dispatcher(),
    );

    return value;
  };

  const wrapper: Method =
    original.constructor.name === 'AsyncFunction'
      ? async function (this: unknown, ...args: unknown[]): Promise<unknown> {
          refuseAfterCommit(original.name, args);

          return announced(args, original.apply(this, args));
        }
      : function (this: unknown, ...args: unknown[]): unknown {
          refuseAfterCommit(original.name, args);

          const result = original.apply(this, args);

          return isThenable(result) && recordedAggregates(args).length > 0 ? announced(args, result) : result;
        };

  Object.defineProperty(wrapper, 'name', { value: original.name, configurable: true });

  return wrapper;
}

function refuseAfterCommit(method: string, args: readonly unknown[]): void {
  if (unitOfWorkScope.getStore()?.stage === 'after-commit' && recordedAggregates(args).length > 0) {
    throw new SaveAfterCommitError(method);
  }
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return typeof value === 'object' && value !== null && 'then' in value && typeof value.then === 'function';
}

function shadowed<T extends object>(instance: T, wrappers: ReadonlyMap<string, Method>): T {
  for (const [name, wrapper] of wrappers) {
    const enumerable = Object.getOwnPropertyDescriptor(instance, name)?.enumerable ?? false;

    Object.defineProperty(instance, name, { value: wrapper, writable: true, configurable: true, enumerable });
  }

  return instance;
}

/** Methods run with the proxy as `this`, so a method the repository calls on itself meets the same wrappers. */
function proxied<T extends object>(instance: T, wrappers: ReadonlyMap<string, Method>): T {
  return new Proxy(instance, {
    get(target, property, receiver: unknown) {
      const wrapper = typeof property === 'string' ? wrappers.get(property) : undefined;

      return wrapper ?? Reflect.get(target, property, receiver);
    },
  });
}
