import type { AggregateRoot } from '../domain/aggregate-root.js';

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  next(): string;
}

/** Runs `work` atomically; domain events are published only when it commits. */
export interface UnitOfWork {
  run<T>(work: () => Promise<T>): Promise<T>;
}

/** Declared by the domain, implemented by infrastructure. One per aggregate root. */
export interface Repository<A extends AggregateRoot<Id>, Id extends string | number = string> {
  findById(id: Id): Promise<A | undefined>;
  save(aggregate: A): Promise<void>;
}

export interface UseCase<Input, Output> {
  execute(input: Input): Promise<Output>;
}

/**
 * The role an instance plays, as a binding declares it at the composition root. Tracing, the
 * dependency injection modules and the aspects all read this one list.
 */
export type DependencyKind =
  | 'repository'
  | 'gateway'
  | 'external'
  | 'use-case'
  | 'publisher'
  | 'consumer'
  | 'job';
