import type { RouteFact } from './context-description.js';
import { listedIn } from './listed-in.js';

/** What a route says of its presentation, in the options of its declaration: the media types it answers and reads in, and its form. */
export function presentationOfRoute(
  options: string,
  operationId: string,
): Pick<RouteFact, 'produces' | 'consumes' | 'form'> {
  const produces = mediaTypes(options, 'produces');
  const consumes = mediaTypes(options, 'consumes');

  return {
    ...(produces.length === 0 ? {} : { produces }),
    ...(consumes.length === 0 ? {} : { consumes }),
    ...(/(?:^|[\n,{])\s*form\s*[,:}\n]/.test(options) ? { form: `GET /forms/${operationId}` } : {}),
  };
}

function mediaTypes(options: string, key: string): string[] {
  return listedIn(options, key).map((entry) => entry.replace(/^['"]|['"]$/g, ''));
}
