import { describe, expect, it } from 'vitest';
import { read } from './helpers';
import { initProject } from './support/init-project';

describe('init docker compose profiles', () => {
  it('says the command that starts a profile: the flag goes before `up`, which the script cannot take after its arguments', () => {
    const root = initProject('--authn', 'keycloak', '--errors', 'sentry');
    const compose = read(root, 'docker-compose.yml');
    const readme = read(root, 'README.md');

    for (const profile of ['observability', 'identity', 'errors']) {
      expect(compose).toContain(`docker compose --profile ${profile} up -d --wait`);
    }

    expect(readme).toContain('docker compose --profile observability up -d --wait');
    expect(`${compose}${readme}`).not.toMatch(/infra:up\s+--profile|add `?--profile/);
  });
});
