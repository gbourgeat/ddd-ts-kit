import type { Upstream } from '../config/index.js';
import type { BackgroundJobFacts } from './background-job-facts.js';
import type { DeclaredFacts } from './declared-facts.js';
import type { ProcessFacts } from './process-facts.js';
import type { StateMachineFacts } from './state-machine-facts.js';

/** What the documentation and `list` say about one bounded context, read from the config and the files. */
export interface ContextFacts {
  readonly name: string;
  readonly classification: string;
  readonly declared: boolean;
  readonly onDisk: boolean;
  readonly purpose: string;
  readonly glossaryTerms: readonly string[];
  readonly upstreams: readonly Upstream[];
  readonly downstreams: readonly Upstream[];
  readonly aggregates: readonly string[];
  readonly commands: readonly string[];
  readonly queries: readonly string[];
  readonly domainEvents: readonly string[];
  readonly publishedEvents: readonly PublishedEvent[];
  readonly builders: readonly string[];
  /** Permission names declared in `application/authorization/<context>.permissions.ts`. */
  readonly permissions: readonly string[];
  readonly policies: readonly string[];
  readonly gateways: readonly string[];
  /** The classes that react to an integration event, `application/integration/handlers/*.integration-handler.ts`. */
  readonly integrationEventHandlers: readonly string[];
  /** The jobs run by time, `application/scheduling/*.job.ts`. */
  readonly jobs: readonly JobFacts[];
  /** The work its use cases enqueue, `application/background/*.background-job.ts`. */
  readonly backgroundJobs: readonly BackgroundJobFacts[];
  /** The lifecycles of its aggregates, `domain/state-machines/*.state-machine.ts`. */
  readonly stateMachines: readonly StateMachineFacts[];
  /** Its process managers, `application/processes/*.process.ts`. */
  readonly processes: readonly ProcessFacts[];
  /** The context has its own entry point under `apps/`. */
  readonly deployable: boolean;
  /** What the decorators of the role files say, in a declared-style project. */
  readonly declarations?: DeclaredFacts;
}

export interface PublishedEvent {
  readonly type: string;
  readonly version: number;
}

export interface JobFacts {
  /** `<context>.<job-name>`, or the class of the job when its registration cannot be read. */
  readonly name: string;
  /** `every 15m`, or `cron 0 7 * * 1-5 (Europe/Paris)`; empty when it cannot be read. */
  readonly schedule: string;
  /** The use case the job sends. */
  readonly command: string;
}
