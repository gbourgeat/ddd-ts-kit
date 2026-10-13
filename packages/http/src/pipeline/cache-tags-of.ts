import { cacheTag, tenantCacheTags } from '@ddd-ts-kit/kernel';
import type { CacheTagSource } from '../cache/cache-tag-source.js';
import { valuesAt } from '../support/values-at.js';

/** What the tags of an answer are read from. */
export interface TaggedParts {
  readonly params: unknown;
  readonly body: unknown;
  readonly tenantId: string | undefined;
}

/** The tags of the resources an answer shows, once each, under the tenant of the request. */
export function cacheTagsOf(sources: readonly CacheTagSource[], parts: TaggedParts): readonly string[] {
  const tags = sources.flatMap((source) => tagsOfSource(source, parts));

  return tenantCacheTags([...new Set(tags)], parts.tenantId);
}

function tagsOfSource(source: CacheTagSource, { params, body }: TaggedParts): string[] {
  if ('param' in source) {
    return identifiersOf(valuesAt(params, source.param)).map((id) => cacheTag(source.resource, id));
  }

  if ('field' in source) {
    return identifiersOf(valuesAt(body, source.field)).map((id) => cacheTag(source.resource, id));
  }

  return [cacheTag(source.resource)];
}

function identifiersOf(values: readonly unknown[]): (string | number)[] {
  return values.filter((value): value is string | number => typeof value === 'string' || typeof value === 'number');
}
