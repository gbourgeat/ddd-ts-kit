import type { Context } from 'hono';
import { mediaTypeOf } from '../representation/media-type-of.js';
import type { EdgeRefusal } from './edge-problem.js';

export type ReadBody =
  | { readonly read: true; readonly value: unknown }
  | { readonly read: false; readonly refusal: EdgeRefusal };

const JSON_MEDIA = /[/+]json\b/;

const MALFORMED: EdgeRefusal = {
  status: 400,
  title: 'Bad Request',
  code: 'MALFORMED_BODY',
  detail: 'The body is not valid JSON.',
};

/**
 * The JSON body of the request, `undefined` when there is none; a body in a media type the route
 * consumes (`consumes`), as text, for its representation to read; not read in any other media
 * type. Read chunk by chunk and given up beyond `limit` bytes, so that no body is held whole past it.
 */
export async function readBody(context: Context, limit: number, consumed: readonly string[] = []): Promise<ReadBody> {
  const contentType = context.req.header('content-type') ?? '';
  const json = JSON_MEDIA.test(contentType);

  if (!json && !consumed.includes(mediaTypeOf(contentType) ?? '')) {
    return { read: true, value: undefined };
  }

  const text = await boundedText(context.req.raw, limit);

  if (text === undefined) {
    return { read: false, refusal: tooLarge(limit) };
  }

  if (text === '') {
    return { read: true, value: undefined };
  }

  return json ? parsed(text) : { read: true, value: text };
}

async function boundedText(request: Request, limit: number): Promise<string | undefined> {
  if (Number(request.headers.get('content-length') ?? 0) > limit) {
    return undefined;
  }

  return request.body === null ? '' : decodedUpTo(request.body, limit);
}

async function decodedUpTo(body: ReadableStream<Uint8Array>, limit: number): Promise<string | undefined> {
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';

  for await (const chunk of body) {
    size += chunk.byteLength;

    if (size > limit) {
      return undefined;
    }

    text += decoder.decode(chunk, { stream: true });
  }

  return text + decoder.decode();
}

function parsed(text: string): ReadBody {
  try {
    const value: unknown = JSON.parse(text);

    return { read: true, value };
  } catch {
    return { read: false, refusal: MALFORMED };
  }
}

function tooLarge(limit: number): EdgeRefusal {
  return {
    status: 413,
    title: 'Payload Too Large',
    code: 'BODY_TOO_LARGE',
    detail: `The body is larger than ${String(limit)} bytes.`,
  };
}
