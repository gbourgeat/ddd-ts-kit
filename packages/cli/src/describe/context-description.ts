import type { Upstream } from '../config/index.js';
import type { JobFacts } from '../docs/context-facts.js';

/**
 * One bounded context as facts, read from the config and from the source text: what `describe`
 * prints and what `docs` writes in the reference of its CONTEXT.md. Paths are relative to the
 * project root; a text that could not be read is empty.
 */
export interface ContextDescription {
  readonly name: string;
  readonly classification: string;
  readonly purpose: string;
  readonly deployable: boolean;
  readonly doc: string;
  readonly glossary: readonly string[];
  readonly upstreams: readonly Upstream[];
  readonly downstreams: readonly Upstream[];
  readonly aggregates: readonly string[];
  readonly domainEvents: readonly string[];
  readonly permissions: readonly string[];
  readonly useCases: readonly UseCaseFact[];
  readonly routes: readonly RouteFact[];
  readonly consumedEvents: readonly ConsumedEventFact[];
  readonly publishedEvents: readonly PublishedEventFact[];
  readonly ports: readonly PortFact[];
  readonly policies: readonly PolicyFact[];
  /** The refusals of the domain, by error class and code. */
  readonly errors: readonly ErrorFact[];
  /** The projectors, `application/projections/*.projection.ts`: each keeps one read model up to date. */
  readonly projections: readonly ProjectionFact[];
  readonly gateways: readonly GatewayFact[];
  readonly jobs: readonly JobFacts[];
  /** The generated contracts that hold what the source text does not say: the fields of each schema. */
  readonly contracts: Contracts;
}

export interface UseCaseFact {
  readonly kind: 'command' | 'query';
  readonly name: string;
  /** `<aggregate>.<action>`, or `public`. */
  readonly permission: string;
  readonly file: string;
}

export interface RouteFact {
  readonly method: string;
  /** The whole path: under the prefixes of its groups, for a controller. */
  readonly path: string;
  readonly operationId: string;
  /** The route group of a controller; empty for a function route and for a controller that names none. */
  readonly group: string;
  /** The guards before a controller, those of its groups first, as written; none for a function route. */
  readonly guards: readonly string[];
  readonly useCase: string;
  readonly permission: string;
  readonly request: readonly RequestPart[];
  readonly responses: readonly RouteResponse[];
  readonly errors: readonly string[];
  /** The media types it answers in besides JSON (`produces`), when it declares some. */
  readonly produces?: readonly string[];
  /** The media types it reads a body in besides JSON (`consumes`), when it declares some. */
  readonly consumes?: readonly string[];
  /** Where its form is served, when it declares one: `GET /forms/<operationId>`. */
  readonly form?: string;
  readonly file: string;
}

export interface RequestPart {
  /** `body`, `params`, `query` or `headers`. */
  readonly part: string;
  /** The schema class, or the name of the schema constant in the route file. */
  readonly schema: string;
}

export interface RouteResponse {
  readonly status: number;
  /** Empty when the response has no body. */
  readonly schema: string;
}

export interface ConsumedEventFact {
  readonly type: string;
  /** The version of the declaration the handler is given; null when the event has no declaration in this repository. */
  readonly version: number | null;
  /** The context that publishes it. */
  readonly from: string;
  readonly handler: string;
  readonly consumer: string;
  readonly file: string;
}

export interface PublishedEventFact {
  readonly type: string;
  readonly versions: readonly number[];
  readonly publishers: readonly string[];
}

export interface PortFact {
  readonly name: string;
  /** `repository`, `gateway`, `external`...: the role its adapters are bound under; empty when it has none. */
  readonly kind: string;
  readonly adapters: readonly string[];
  readonly file: string;
}

export interface PolicyFact {
  readonly name: string;
  readonly permission: string;
  readonly file: string;
}

export interface ErrorFact {
  /** The error class: the one of a concept, or the class of one error in the form of 0.2. */
  readonly errorClass: string;
  /** The static factory that builds the refusal; empty for a class per error. */
  readonly refusal: string;
  readonly code: string;
  /** The facts the factory lets a client read, by name: the others stay in the process. */
  readonly exposes: readonly string[];
  readonly file: string;
}

export interface ProjectionFact {
  /** `<context>.<name>`, the consumer the projection is subscribed as; empty when it is not written as a literal. */
  readonly name: string;
  readonly projector: string;
  /** The event definitions and domain event classes its `@On` methods name, in order. */
  readonly applies: readonly string[];
  readonly file: string;
}

export interface GatewayFact {
  readonly name: string;
  /** The context whose published language the gateway reads; empty for a system outside the repository. */
  readonly upstream: string;
  readonly adapters: readonly string[];
  readonly file: string;
}

export interface Contracts {
  readonly openapi: string;
  readonly eventCatalog: string;
}
