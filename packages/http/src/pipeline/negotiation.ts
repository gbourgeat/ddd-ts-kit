import { negotiate } from '../representation/negotiate.js';
import type { Chosen, Representations } from '../representation/representations.js';
import type { RawHeaders } from '../route/raw-headers.js';
import type { Route } from '../route/route.js';

/** What the `Accept` header of a request chose: the representation of the answer, if any fits, and the one of a refusal. */
export interface Negotiation {
  readonly representations: Representations;
  /** `undefined` when the header accepts none of the media types the route answers in: the request is answered 406. */
  readonly answer: Chosen | undefined;
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

  return {
    representations,
    answer: mediaType === undefined ? undefined : representations.answerIn(mediaType),
    problem: representations.problemIn(mediaType),
    varies: offered.length > 1,
  };
}
