import { edgeAnswer } from '../error/edge-answer';
import type { EdgeRefusal } from '../error/edge-refusal';
import type { RawHeaders } from '../route/raw-headers';

/** The answer to a request refused at the edge: a problem document, as every other refusal. */
export function edgeProblem(headers: RawHeaders, refusal: EdgeRefusal): Response {
  const answer = edgeAnswer(headers, refusal);

  return new Response(JSON.stringify(answer.problem), { status: answer.status, headers: answer.headers });
}
