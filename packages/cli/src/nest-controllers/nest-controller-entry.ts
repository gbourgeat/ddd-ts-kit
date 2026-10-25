import type { NestAnswer } from './nest-answer';

/** A Nest controller of a context the kit serves, and what each of its route methods answers. */
export interface NestControllerEntry {
  readonly file: string;
  readonly className: string;
  readonly specifier: string;
  readonly methods: readonly NestRouteMethod[];
}

/** A route method of a Nest controller: what its signature says it answers, and whether `@KitRoute` says it instead. */
export interface NestRouteMethod {
  readonly name: string;
  readonly line: number;
  readonly answer: NestAnswer;
  readonly declaresResponse: boolean;
}
