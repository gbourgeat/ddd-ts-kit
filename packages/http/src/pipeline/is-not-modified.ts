import type { RawHeaders } from '../route/raw-headers.js';
import { headerText } from '../support/header-text.js';

const ANY = '*';
const WEAK = /^W\//;

/**
 * Whether the version the caller holds is still the current one (RFC 9110, 13.2.2): `If-None-Match`
 * names the `ETag` of the answer, compared weakly, or, when it is not sent, nothing changed since
 * `If-Modified-Since`, to the second.
 */
export function isNotModified(request: Readonly<RawHeaders>, answered: Readonly<Record<string, string>>): boolean {
  const noneMatch = headerText(request['if-none-match']);

  if (noneMatch !== undefined) {
    return answered['etag'] !== undefined && namesTag(noneMatch, answered['etag']);
  }

  const since = Date.parse(headerText(request['if-modified-since']) ?? '');
  const modified = Date.parse(answered['last-modified'] ?? '');

  return Number.isFinite(since) && Number.isFinite(modified) && modified <= since;
}

function namesTag(list: string, tag: string): boolean {
  if (list.trim() === ANY) {
    return true;
  }

  return list.split(',').some((written) => opaque(written.trim()) === opaque(tag));
}

function opaque(tag: string): string {
  return tag.replace(WEAK, '');
}
