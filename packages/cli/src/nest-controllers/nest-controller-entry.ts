import type { NestAnswer } from './nest-answer';
import type { NestRequestPart } from './nest-request-part';

/** A Nest controller of a context the kit serves, and what the signature of each of its route methods says. */
export interface NestControllerEntry {
  readonly file: string;
  readonly className: string;
  readonly specifier: string;
  readonly methods: readonly NestRouteMethod[];
}

/** A route method of a Nest controller: what its signature says it takes and answers, and whether `@KitRoute` says its answer instead. */
export interface NestRouteMethod {
  readonly name: string;
  readonly line: number;
  readonly request: readonly NestRequestPart[];
  readonly answer: NestAnswer;
  readonly declaresResponse: boolean;
}
