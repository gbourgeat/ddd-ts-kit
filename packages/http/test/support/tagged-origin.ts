import { createServer, type Server } from 'node:http';

/**
 * An application behind a shared cache: it answers each path as public for five minutes, filed
 * under the tags given for it, or with no Cache-Control at all, as a route without a policy.
 */
export interface TaggedOrigin {
  answerUnder(path: string, tags: readonly string[]): void;
  answerWithoutPolicy(path: string): void;
  close(): Promise<void>;
}

export async function startTaggedOrigin(port: number): Promise<TaggedOrigin> {
  const tagsByPath = new Map<string, readonly string[]>();
  const withoutPolicy = new Set<string>();

  const server: Server = createServer((request, response) => {
    const path = request.url ?? '';
    const tags = tagsByPath.get(path) ?? [];
    const policy = withoutPolicy.has(path) ? {} : { 'cache-control': 'public, max-age=300' };

    response.writeHead(200, { 'content-type': 'text/plain', ...policy, xkey: tags.join(' ') });

    response.end(request.url);
  });

  await new Promise<void>((resolve) => server.listen(port, '0.0.0.0', resolve));

  return {
    answerUnder: (path, tags) => tagsByPath.set(path, tags),
    answerWithoutPolicy: (path) => withoutPolicy.add(path),
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
