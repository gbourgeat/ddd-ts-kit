import { describe, expect, it } from 'vitest';
import { cli, exists, read } from './helpers';
import { initProject } from './support/init-project';

describe('the name of a bounded context', () => {
  it.each(['shared-kernel', 'platform', 'utils', 'test', 'domain', 'application', 'shared', 'common', 'core'])(
    'is refused as %s by generate context, nothing written',
    (name) => {
      const root = initProject('--context', 'billing:core', '--audit', 'off');
      const config = read(root, 'ddd-ts-kit.config.json');

      const refused = cli(root, 'generate', 'context', name, '--classification', 'generic');

      expect(refused.code).toBe(2);
      expect(refused.stderr).toContain(`error: "${name}" cannot name a bounded context`);
      expect(read(root, 'ddd-ts-kit.config.json')).toBe(config);
      expect(exists(root, `src/contexts/${name}`)).toBe(false);
    },
  );

  it.each(['core-banking', 'platform-fees', 'data-room', 'shared-services'])(
    'is accepted as %s: only the whole name is judged',
    (name) => {
      const root = initProject('--context', 'billing:core', '--audit', 'off');

      expect(cli(root, 'generate', 'context', name, '--classification', 'generic').code).toBe(0);
    },
  );

  it('is refused by init --context too', () => {
    const refused = cli(initProject(), 'init', '--force', '--context', 'utils:core', '--dry-run');

    expect(refused.code).toBe(2);
    expect(refused.stderr).toContain('"utils" cannot name a bounded context');
  });

  it('is accepted when it names a capability', () => {
    const root = initProject('--context', 'billing:core', '--audit', 'off');

    expect(cli(root, 'generate', 'context', 'order-fulfilment', '--classification', 'generic').code).toBe(0);
  });
});
