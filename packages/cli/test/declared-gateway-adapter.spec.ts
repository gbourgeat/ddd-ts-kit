import { describe, expect, it } from 'vitest';
import { cli, exists, read, tempDir } from './helpers';

const BILLING = 'src/contexts/billing';

describe('a declared adapter towards another context', () => {
  it('is a gateway: its file and its decorator say so', () => {
    const project = tempDir('declared');

    cli(project, 'init', '--context', 'billing:core');
    cli(project, 'generate', 'port', 'billing', 'Stock');

    expect(cli(project, 'generate', 'adapter', 'billing', 'Stock', '--kind', 'gateway').code).toBe(0);

    expect(read(project, `${BILLING}/infrastructure/external/remote-stock.gateway.ts`)).toContain(
      '@Gateway(Stock, {\n  aspects: [ownPolicy(retry({ attempts: 3, backoff: { baseMs: 100 } }), timeout(2000))],\n})',
    );

    expect(exists(project, `${BILLING}/infrastructure/external/remote-stock.adapter.ts`)).toBe(false);
  });
});
