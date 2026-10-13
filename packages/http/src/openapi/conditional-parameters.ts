import type { JsonSchema } from '@ddd-ts-kit/validation';
import { IfMatch } from '../cache/if-match.js';
import type { Route } from '../route/route.js';

const TEXT = { type: 'string' };

/** The conditional request headers a route reads: `If-None-Match`, `If-Modified-Since`, `If-Match`. */
export function conditionalParameters(route: Route): JsonSchema[] {
  const { cache, ifMatch } = route;

  return [
    ...(cache?.etag === undefined
      ? []
      : [header('If-None-Match', 'The ETag of the version the caller holds: 304 when it is still the current one.')]),
    ...(cache?.lastModified === undefined
      ? []
      : [header('If-Modified-Since', 'The Last-Modified the caller holds: 304 when nothing changed since.')]),
    ...(ifMatch === undefined
      ? []
      : [
          {
            ...header(
              'If-Match',
              'The ETag of the version this change was made on: 412 when it is no longer the current one.',
            ),
            required: ifMatch === IfMatch.required,
          },
        ]),
  ];
}

function header(name: string, description: string): JsonSchema {
  return { name, in: 'header', description, required: false, schema: TEXT };
}
