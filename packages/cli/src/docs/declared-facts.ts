/** A context read through its declarations: who may send each use case, what each handler consumes, what each adapter binds. */
export interface DeclaredFacts {
  readonly useCases: readonly DeclaredUseCase[];
  readonly integrationEventHandlers: readonly DeclaredIntegrationEventHandler[];
  readonly policies: readonly DeclaredPolicy[];
  readonly gateways: readonly DeclaredBinding[];
  /** Repositories and the adapters of the other ports. */
  readonly adapters: readonly DeclaredBinding[];
}

export interface DeclaredUseCase {
  readonly kind: 'command' | 'query';
  readonly name: string;
  /** The permission `@Requires` names, or `public`. */
  readonly requires: string;
}

interface DeclaredIntegrationEventHandler {
  readonly name: string;
  /** The consumer name, empty when it is not written as a literal. */
  readonly consumer: string;
  /** The event definition the handler is given. */
  readonly event: string;
}

interface DeclaredPolicy {
  readonly name: string;
  readonly permission: string;
}

export interface DeclaredBinding {
  readonly name: string;
  /** The port the class is the adapter of, as its declaration names it. */
  readonly token: string;
}
