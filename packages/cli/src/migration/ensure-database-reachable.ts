import { spawnSync } from 'node:child_process';
import { CliError } from '../cli-error';
import { UNWRITTEN_EXIT_CODE } from '../workspace/exit-code-of';

/** The default port of each server the kit can generate migrations for. */
const DEFAULT_PORTS: Readonly<Record<string, number>> = { 'postgres:': 5432, 'postgresql:': 5432, 'mysql:': 3306 };

/** How long a server has to accept a connection before it is taken as out of reach. */
const PROBE_TIMEOUT_MS = 3000;

/** Opens a TCP connection and exits 0 once it is open; the sandbox of a session refuses it, a stopped server too. */
const PROBE = `const s = require('node:net').connect({ host: process.argv[1], port: Number(process.argv[2]) });
s.setTimeout(${PROBE_TIMEOUT_MS});
s.on('connect', () => process.exit(0));
s.on('timeout', () => process.exit(1));
s.on('error', () => process.exit(1));`;

/**
 * Stops with exit 3, the code of what this session cannot do here, before an ORM tool that needs a
 * live database (`prisma migrate dev`, `typeorm migration:generate`) fails with a raw connection
 * error. Under the sandbox of the regulated profile a command cannot open a TCP connection to the
 * database of the project, whatever `sandbox.network` allows (the probe of the issue, Claude Code
 * 2.1.311 on Linux): the migration is the owner's, or the pipeline's. Nothing is checked when
 * `DATABASE_URL` is not set in the environment: the tool then says what it lacks.
 */
export function ensureDatabaseReachable(
  environment: NodeJS.ProcessEnv = process.env,
  probe: (endpoint: { host: string; port: number }) => boolean = canConnect,
): void {
  const endpoint = databaseEndpointOf(environment['DATABASE_URL']);

  if (endpoint === undefined || probe(endpoint)) {
    return;
  }

  throw new CliError(
    `The database at ${endpoint.host}:${endpoint.port} cannot be reached from this session.`,
    'Migrations and database tests run outside the sandbox of the agent: the owner of the project (or the CI) runs this command from a terminal, with the database up. If the database is simply stopped, start it (`npm run infra:up`) and run the command again.',
    UNWRITTEN_EXIT_CODE,
  );
}

/** Where the `DATABASE_URL` of the process points, or `undefined` when it is not set, not a TCP server of the kit, or a socket. */
function databaseEndpointOf(url: string | undefined): { host: string; port: number } | undefined {
  if (url === undefined || url.trim() === '') {
    return undefined;
  }

  try {
    const parsed = new URL(url);
    const port = parsed.port === '' ? DEFAULT_PORTS[parsed.protocol] : Number(parsed.port);
    const host = parsed.hostname.replace(/^\[|\]$/g, '');

    return port === undefined || host === '' ? undefined : { host, port };
  } catch {
    return undefined;
  }
}

function canConnect({ host, port }: { host: string; port: number }): boolean {
  const result = spawnSync(process.execPath, ['-e', PROBE, host, String(port)], {
    timeout: PROBE_TIMEOUT_MS + 2000,
    stdio: 'ignore',
  });

  return result.status === 0;
}
