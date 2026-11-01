import { randomBytes } from 'node:crypto';
import { fetchTransport, type OpenSearchTransport } from '../../src';
import { OpenSearchServer } from './fake/open-search-server';

const CREDENTIALS = {
  username: process.env['DDD_TS_KIT_TEST_OPENSEARCH_USERNAME'] ?? 'ddd-ts-kit',
  password: process.env['DDD_TS_KIT_TEST_OPENSEARCH_PASSWORD'] ?? 'ddd-ts-kit-secret',
};

/** A node the specs run on, reached through `fetchTransport`. */
export interface SearchNode {
  readonly transport: OpenSearchTransport;
  /** The settings of every index the specs create: no replica on one node, and a short refresh. */
  readonly settings: Readonly<Record<string, unknown>>;
  /** Removes the indices of a read model a spec created. */
  drop(indices: readonly string[]): Promise<void>;
  stop(): Promise<void>;
}

type NodeRow = readonly [name: string, start: () => Promise<SearchNode>];

const SETTINGS = { number_of_replicas: 0, refresh_interval: '50ms' };

/** The real node named by `DDD_TS_KIT_TEST_OPENSEARCH_URL`, OpenSearch 3 in the pipeline, with the security plugin off. */
async function onUrl(url: string): Promise<SearchNode> {
  const transport = fetchTransport({ node: url });

  return {
    transport,
    settings: SETTINGS,
    drop: (indices) => dropped(transport, indices),
    stop: () => Promise.resolve(),
  };
}

/** The in-memory OpenSearch, on a port of its own, behind the credentials of the security plugin. */
async function inMemory(): Promise<SearchNode> {
  const server = await OpenSearchServer.start(CREDENTIALS);
  const transport = fetchTransport({ node: `${server.url}/`, auth: CREDENTIALS });

  return { transport, settings: SETTINGS, drop: (indices) => dropped(transport, indices), stop: () => server.stop() };
}

async function dropped(transport: OpenSearchTransport, indices: readonly string[]): Promise<void> {
  if (indices.length > 0) {
    await transport.request({ method: 'DELETE', path: `/${indices.join(',')}`, query: { ignore_unavailable: 'true' } });
  }
}

const url = process.env['DDD_TS_KIT_TEST_OPENSEARCH_URL'] ?? '';
const real: readonly NodeRow[] = url === '' ? [] : [['on OpenSearch', () => onUrl(url)]];

/**
 * The nodes the specs run on: the in-memory one always, a real one when
 * `DDD_TS_KIT_TEST_OPENSEARCH_URL` names it. As `[name, start]` rows for `describe.each`.
 */
export const NODES: readonly NodeRow[] = [['in memory', inMemory], ...real];

/** A read model name of its own for each test: the indices of two tests never meet. */
export function aReadModelName(): string {
  return `rm_${randomBytes(5).toString('hex')}`;
}
