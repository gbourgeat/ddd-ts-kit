import { isRecord } from '../config/values/is-record';
import type { ClientResponse } from './client-response';
import { isJson } from './is-json';

const PROBLEM = 'application/problem+json';

/** The responses with a numeric status; `default` and ranges such as `4XX` say no status the client can type. */
export function readResponses(value: unknown): ClientResponse[] {
  const responses = isRecord(value) ? value : {};

  return Object.entries(responses).flatMap(([key, response]) =>
    /^\d{3}$/.test(key) ? [responseOf(Number(key), isRecord(response) ? response : {})] : [],
  );
}

function responseOf(status: number, raw: Record<string, unknown>): ClientResponse {
  const content = isRecord(raw['content']) ? raw['content'] : {};
  const failure = status >= 400;
  const [read, chosen] = mediaOf(Object.keys(content), failure);
  const media = chosen === undefined ? undefined : content[chosen];
  const codes: unknown[] = failure && Array.isArray(raw['x-error-codes']) ? raw['x-error-codes'] : [];

  return {
    status,
    read,
    schema: isRecord(media) ? media['schema'] : undefined,
    codes: codes.filter((code) => typeof code === 'string'),
    description: typeof raw['description'] === 'string' ? raw['description'] : '',
  };
}

/** The media type the client reads: the problem document of a refusal, JSON, text, in that order. */
function mediaOf(types: readonly string[], failure: boolean): [ClientResponse['read'], string | undefined] {
  const json = failure && types.includes(PROBLEM) ? PROBLEM : types.find(isJson);

  if (json !== undefined) {
    return ['json', json];
  }

  const text = types.find((type) => type.startsWith('text/'));

  return text === undefined ? ['none', undefined] : ['text', text];
}
