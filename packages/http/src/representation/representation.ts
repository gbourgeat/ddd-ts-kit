import type { BodyShape } from './body-shape.js';
import type { RepresentedBody } from './represented-body.js';

/**
 * Turns the value a route answers into the text of one media type, and back for a request body
 * when the media type is accepted as input. The value is the one the response schema checked:
 * a representation never sees an aggregate. Registered once in the platform (`Representations`)
 * and chosen per request by the `Accept` header.
 */
export abstract class Representation {
  /** `application/xml`, without parameters. */
  abstract readonly mediaType: string;

  /** The media type a refusal is written in when this one was negotiated; `undefined`, `application/problem+json`. */
  abstract readonly problemMediaType: string | undefined;

  abstract write(body: unknown, shape: BodyShape): RepresentedBody;

  /** The value the JSON path would have produced, before the schema validates it. Absent, the media type is never read. */
  abstract read?(text: string, shape: BodyShape): unknown;

  /** Why a body of this shape cannot be written in this media type, when it cannot: checked when the routes are mounted. */
  abstract refuses?(shape: BodyShape): string | undefined;
}
