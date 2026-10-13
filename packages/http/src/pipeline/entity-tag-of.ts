import type { EntityTagSource } from '../cache/entity-tag-source.js';
import { ResponseContractError } from '../error/response-contract-error.js';
import { valuesAt } from '../support/values-at.js';
import type { RouteResponse } from './route-response.js';
import { serializeBody } from './serialize-body.js';

/**
 * The `ETag` of an answer: strong, the SHA-256 of the bytes sent, for `representation`; weak,
 * the version the value answered carries, for `{ version }`, the same in every representation.
 * A value without that version is an answer its declaration does not allow.
 */
export async function entityTagOf(
  source: EntityTagSource,
  response: RouteResponse,
  value: unknown = response.body,
): Promise<string> {
  if (source === 'representation') {
    return `"${await digestOf(serializeBody(response) ?? '')}"`;
  }

  const [version] = valuesAt(value, source.version);

  if (typeof version !== 'number' && typeof version !== 'string') {
    throw new ResponseContractError(`The answer carries no version under "${source.version}" for its ETag.`);
  }

  return `W/"${version}"`;
}

async function digestOf(sent: string | Uint8Array): Promise<string> {
  const bytes = typeof sent === 'string' ? new TextEncoder().encode(sent) : sent;
  const digest = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes));
  const base64 = btoa(String.fromCharCode(...digest));

  return base64.replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
