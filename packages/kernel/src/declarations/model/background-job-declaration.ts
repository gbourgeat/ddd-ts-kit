import type { BackgroundJobOptions } from '../../application/background/background-job-options';
import type { BackgroundJobPayloadSchema } from '../../application/background/background-job-payload-schema';
import type { BackgroundJob } from '../../application/background/background-job';
import type { Token } from '../token/token';

export interface BackgroundJobDeclaration {
  readonly role: 'background-job';
  /** The static `jobName` of the class, `<context>.<job-name>`: its queue is the context. */
  readonly name: string;
  /** As written: the defaults are filled in where the job is registered. */
  readonly options: BackgroundJobOptions;
  /** The static `payload` of the class: the schema the worker reads the stored payload with. */
  readonly payload: BackgroundJobPayloadSchema<unknown>;
  readonly implementation: new (...args: never) => BackgroundJob<unknown>;
  /** The list the decorator wrote; `undefined` when the constructor states the dependencies. */
  readonly dependencies: readonly Token<unknown>[] | undefined;
}
