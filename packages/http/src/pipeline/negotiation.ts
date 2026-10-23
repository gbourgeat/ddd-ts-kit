import { negotiate } from '../representation/negotiate';
import type { Chosen, Representations } from '../representation/representations';
import type { RawHeaders } from '../route/raw-headers';
import { answersWithSchema } from '../route/answers-with-schema';
import type { Route } from '../route/route';

/** What the `Accept` header of a request chose: the representation of the answer, if any fits, and the one of a refusal. */
export interface Negotiation {
  readonly representations: Representations;
  /**
   * `undefined` when the answer is the handler's own (a route that declares no body schema: a
   * file, a redirect, no content), or when nothing fits, which `refused` then says.
   */
  readonly answer: Chosen | undefined;
  /** The header accepts none of the media types the route answers in: the request is answered 406. */
  readonly refused: boolean;
  readonly problem: Chosen;
  /** Whether the route answers in more than one media type, which makes caches key on `Accept`. */
  readonly varies: boolean;
}

export function negotiation(
  route: Route,
  headers: Readonly<RawHeaders>,
  representations: Representations,
): Negotiation {
  const offered = representations.offeredBy(route);
  const accept = headers['accept'];
  const mediaType = negotiate(Array.isArray(accept) ? accept.join(',') : accept, offered);
  const problem = representations.problemIn(mediaType);

  if (!answersWithSchema(route)) {
    return { representations, answer: undefined, refused: false, problem, varies: false };
  }

  return {
    representations,
    answer: mediaType === undefined ? undefined : representations.answerIn(mediaType),
    refused: mediaType === undefined,
    problem,
    varies: offered.length > 1,
  };
}
