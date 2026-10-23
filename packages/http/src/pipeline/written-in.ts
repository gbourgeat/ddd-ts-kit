import type { BodyShape } from '../representation/body-shape';
import { JsonRepresentation } from '../representation/json-representation';
import type { Chosen } from '../representation/representations';
import { isAsyncIterable } from '../support/is-async-iterable';
import type { RepresentedAnswer } from './represented-answer';

const encoder = new TextEncoder();

/**
 * A value in the representation chosen for it: bytes at once, or chunks for a streamed list. A
 * value answered in the JSON of the kit stays the value, which the adapter writes as JSON as it
 * always did, and which a spec calling `executeRoute` reads as it is.
 */
export function writtenIn(value: unknown, chosen: Chosen, shape: BodyShape): RepresentedAnswer {
  const headers = { 'content-type': `${chosen.mediaType}; charset=utf-8` };

  if (chosen.representation instanceof JsonRepresentation && !isAsyncIterable(value)) {
    return { headers, body: value };
  }

  const written = chosen.representation.write(value, shape);

  return typeof written === 'string' ? { headers, body: encoder.encode(written) } : { headers, stream: written };
}
