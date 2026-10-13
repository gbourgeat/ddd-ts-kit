import type { Context } from 'hono';

export type ReadBody = { readonly read: true; readonly value: unknown } | { readonly read: false };

const JSON_MEDIA = /[/+]json\b/;

/** The JSON body of the request, `undefined` when there is none; not read when it is not JSON. */
export async function readBody(context: Context): Promise<ReadBody> {
  const text = await context.req.text();

  if (text === '' || !JSON_MEDIA.test(context.req.header('content-type') ?? '')) {
    return { read: true, value: undefined };
  }

  try {
    const value: unknown = JSON.parse(text);

    return { read: true, value };
  } catch {
    return { read: false };
  }
}
