import type { DependencyKind } from '../application/ports.js';
import type { BindingAspect, PortDeclaration } from './declaration.js';
import type { ClassDeclarator, Dependencies } from './dependencies.js';
import { record } from './registry.js';
import type { Token } from './token.js';

export interface PortOptions {
  /** A new instance on every resolution, instead of one per application. */
  readonly transient?: boolean;
  /**
   * The class takes the place of a binding made by a module listed earlier, typically a default
   * of the kernel module: a database unit of work, an outbox publisher.
   */
  readonly replaces?: boolean;
  /** Wraps every instance, the first aspect outermost: `aspects: [retry(...), timeout(2000)]`. */
  readonly aspects?: readonly BindingAspect[];
}

export interface AdapterOptions extends PortOptions {
  /** What the adapter reaches: an outside system (the default) or the event transport. */
  readonly kind?: 'external' | 'publisher';
}

/**
 * The adapter of a repository interface of the domain, bound to its token:
 * `@Repository(ORDERS, [DATABASE, EXECUTION_SCOPE, CLOCK])`.
 */
export function Repository<T, const D extends Dependencies = readonly []>(
  port: Token<T>,
  dependencies?: D,
): ClassDeclarator<T, D>;
export function Repository<T, const D extends Dependencies = readonly []>(
  port: Token<T>,
  options: PortOptions,
  dependencies?: D,
): ClassDeclarator<T, D>;
export function Repository<T, D extends Dependencies>(
  port: Token<T>,
  ...settings: Settings<PortOptions, D>
): ClassDeclarator<T, D> {
  return declaring({ role: 'repository', kind: 'repository', token: port }, settings);
}

/**
 * The adapter of a port through which this context calls another one synchronously: in
 * process today, a remote client tomorrow. `@Gateway(STOCK, [HTTP])`.
 */
export function Gateway<T, const D extends Dependencies = readonly []>(
  port: Token<T>,
  dependencies?: D,
): ClassDeclarator<T, D>;
export function Gateway<T, const D extends Dependencies = readonly []>(
  port: Token<T>,
  options: PortOptions,
  dependencies?: D,
): ClassDeclarator<T, D>;
export function Gateway<T, D extends Dependencies>(
  port: Token<T>,
  ...settings: Settings<PortOptions, D>
): ClassDeclarator<T, D> {
  return declaring({ role: 'gateway', kind: 'gateway', token: port }, settings);
}

/**
 * The adapter of any other port of the application layer:
 * `@Adapter(PAYMENTS, { kind: 'external' }, [CONFIG])`.
 */
export function Adapter<T, const D extends Dependencies = readonly []>(
  port: Token<T>,
  dependencies?: D,
): ClassDeclarator<T, D>;
export function Adapter<T, const D extends Dependencies = readonly []>(
  port: Token<T>,
  options: AdapterOptions,
  dependencies?: D,
): ClassDeclarator<T, D>;
export function Adapter<T, D extends Dependencies>(
  port: Token<T>,
  ...settings: Settings<AdapterOptions, D>
): ClassDeclarator<T, D> {
  const [first] = settings;
  const kind = isDependencies(first) ? undefined : first?.kind;
  return declaring({ role: 'adapter', kind: kind ?? 'external', token: port }, settings);
}

type Settings<Options, D> = readonly [optionsOrDependencies?: Options | D, dependencies?: D];

interface Port<T> {
  readonly role: PortDeclaration['role'];
  readonly kind: DependencyKind;
  readonly token: Token<T>;
}

function declaring<T, D extends Dependencies>(
  port: Port<T>,
  [first, second]: Settings<PortOptions, D>,
): ClassDeclarator<T, D> {
  const options = isDependencies(first) ? {} : (first ?? {});
  const dependencies = isDependencies(first) ? first : (second ?? []);
  return (target) => {
    record(target, {
      ...port,
      lifetime: options.transient === true ? 'transient' : 'singleton',
      replaces: options.replaces === true,
      aspects: options.aspects ?? [],
      implementation: target,
      dependencies,
    });
  };
}

function isDependencies(value: unknown): value is Dependencies {
  return Array.isArray(value);
}
