import { createServer, type Server } from 'node:http';

/** An application behind a shared cache: it answers each path as public for five minutes, filed under the tags given for it. */
export interface TaggedOrigin {
  answerUnder(path: string, tags: readonly string[]): void;
  close(): Promise<void>;
}

export async function startTaggedOrigin(port: number): Promise<TaggedOrigin> {
  const tagsByPath = new Map<string, readonly string[]>();

  const server: Server = createServer((request, response) => {
    const tags = tagsByPath.get(request.url ?? '') ?? [];

    response.writeHead(200, {
      'content-type': 'text/plain',
      'cache-control': 'public, max-age=300',
      xkey: tags.join(' '),
    });

    response.end(request.url);
  });

  await new Promise<void>((resolve) => server.listen(port, '0.0.0.0', resolve));

  return {
    answerUnder: (path, tags) => tagsByPath.set(path, tags),
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
