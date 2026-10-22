import type { ContextConfig, ModuleConfig, Upstream } from './config.js';
import { isRecord } from './values/is-record.js';
import { posix } from './values/posix.js';
import { text } from './values/text.js';

export function parseContext(value: unknown): ContextConfig {
  const raw = isRecord(value) ? value : {};
  const upstreams: unknown[] = Array.isArray(raw['upstreams']) ? raw['upstreams'] : [];
  const extra: unknown[] = Array.isArray(raw['extraDirectories']) ? raw['extraDirectories'] : [];

  return {
    classification: text(raw['classification'], ''),
    upstreams: upstreams.map(parseUpstream).filter((upstream) => upstream !== undefined),
    extraDirectories: extra.map(parseExtraDirectory).filter((directory) => directory !== undefined),
    deployable: raw['deployable'] === true,
    modules: isRecord(raw['modules']) ? Object.entries(raw['modules']).map(parseModule) : [],
  };
}

/** `"<module>": {}`, or `"<module>": { "classification": ... }` when its subdomain is not classified as its context. */
function parseModule([name, value]: [string, unknown]): ModuleConfig {
  const classification =
    isRecord(value) && typeof value['classification'] === 'string' ? value['classification'] : undefined;

  return classification === undefined ? { name } : { name, classification };
}

function parseUpstream(value: unknown): Upstream | undefined {
  if (typeof value === 'string') {
    return { context: value, relationship: 'published-language' };
  }

  if (!isRecord(value) || typeof value['context'] !== 'string') {
    return undefined;
  }

  return { context: value['context'], relationship: text(value['relationship'], 'published-language') };
}

/** An extra directory is a path, or `{ "path": ..., "reason": ... }` so the decision is documented. */
function parseExtraDirectory(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return posix(value);
  }

  if (isRecord(value) && typeof value['path'] === 'string') {
    return posix(value['path']);
  }

  return undefined;
}
