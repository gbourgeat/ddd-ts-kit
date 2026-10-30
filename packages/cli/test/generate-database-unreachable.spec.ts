import net from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { cli, exists, tempDir, write } from './helpers';

/** A project whose ORM tool is a stand-in that leaves a mark when it runs. */
function projectWithTool(bin: string): string {
  const root = tempDir('database-unreachable');

  write(root, 'ddd-ts-kit.config.json', JSON.stringify({ contexts: {} }));
  write(root, bin, "require('node:fs').writeFileSync('tool-ran', '');\n");

  return root;
}

async function closedPort(): Promise<number> {
  const server = net.createServer();

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  const { port } = server.address() as net.AddressInfo;

  await new Promise((resolve) => server.close(resolve));

  return port;
}

const saved = process.env['DATABASE_URL'];

afterEach(() => {
  if (saved === undefined) {
    delete process.env['DATABASE_URL'];
  } else {
    process.env['DATABASE_URL'] = saved;
  }
});

describe.each([
  ['prisma-generate', 'node_modules/prisma/build/index.js', ['--name', 'init']],
  ['typeorm-generate', 'node_modules/typeorm/cli.js', ['migrations/init']],
])('ddd-ts-kit %s when the database cannot be reached', (command, bin, args) => {
  it('exits 3 with the sentence of the sandbox before the tool runs', async () => {
    const root = projectWithTool(bin);

    process.env['DATABASE_URL'] = `postgres://app:app@127.0.0.1:${await closedPort()}/app`;

    const result = cli(root, command, ...args);

    expect(result.code).toBe(3);
    expect(result.stderr).toContain('cannot be reached from this session');
    expect(result.stderr).toContain('Migrations and database tests run outside the sandbox of the agent');
    expect(exists(root, 'tool-ran')).toBe(false);
  });

  it('runs the tool when the database answers', async () => {
    const root = projectWithTool(bin);
    const server = net.createServer((socket) => socket.destroy());

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

    const { port } = server.address() as net.AddressInfo;

    process.env['DATABASE_URL'] = `postgres://app:app@127.0.0.1:${port}/app`;

    try {
      // The kernel completes the handshake from the backlog, though this process is blocked on the probe.
      expect(cli(root, command, ...args).stderr).not.toContain('cannot be reached');
    } finally {
      server.close();
    }
  });

  it('starts no probe when DATABASE_URL is not set: it generates on the in-process database, or says what it lacks', () => {
    const root = projectWithTool(bin);

    delete process.env['DATABASE_URL'];

    const result = cli(root, command, ...args);

    expect(result.stderr).not.toContain('cannot be reached');
    expect(result.code).not.toBe(0);
    expect(exists(root, 'tool-ran')).toBe(false);
  });

  it('starts no probe when DATABASE_URL is not a URL: the tool says what it makes of it', () => {
    const root = projectWithTool(bin);

    process.env['DATABASE_URL'] = 'not a url at all';

    expect(cli(root, command, ...args).stderr).not.toContain('cannot be reached');
    expect(exists(root, 'tool-ran')).toBe(true);
  });
});
