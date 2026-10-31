import { describe, expect, it } from 'vitest';
import { cli, read } from './helpers';
import { initProject } from './support/init-project';

const reported = (...flags: readonly string[]): string => initProject('--errors', 'sentry', ...flags);

describe('a local GlitchTip', () => {
  it('runs behind the compose profile errors, with its own PostgreSQL and Valkey and its port from .env', () => {
    const compose = read(reported(), 'docker-compose.yml');
    const services = compose.slice(0, compose.indexOf('\nvolumes:'));

    expect(compose.split('\n').slice(0, 6).join('\n')).toContain(
      'docker compose --profile errors up -d --wait          # GlitchTip',
    );

    expect(services).toContain('\n  glitchtip:\n    image: glitchtip/glitchtip:6.2.6\n    profiles: [errors]\n');
    expect(services).toContain('\n  glitchtip-postgres:\n    image: postgres:18-alpine\n    profiles: [errors]\n');
    expect(services).toContain('\n  glitchtip-valkey:\n    image: valkey/valkey:9-alpine\n    profiles: [errors]\n');
    expect(services).toContain('      - "127.0.0.1:${GLITCHTIP_PORT:-8000}:8000"\n');
    expect(services).toContain('      GLITCHTIP_DOMAIN: http://localhost:${GLITCHTIP_PORT:-8000}\n');
    expect(services).toContain('      GLITCHTIP_BOOTSTRAP_DEV: "true"\n');
    expect(compose.slice(compose.indexOf('\nvolumes:'))).toContain('\n  glitchtip-postgres:\n');
    expect(compose.match(/profiles: \[errors\]/g)).toHaveLength(3);
  });

  it('declares its volume where the stack had none, and keeps the services added later before the volumes', () => {
    const root = reported('--orm', 'none', '--context', 'billing:core');

    expect(read(root, 'docker-compose.yml')).toMatch(/\nvolumes:\n {2}glitchtip-postgres:\n$/);
    expect(cli(root, 'generate', 'worker').code).toBe(0);
    expect(cli(root, 'generate', 'service', 'billing').code).toBe(0);

    const compose = read(root, 'docker-compose.yml');

    expect(compose.indexOf('\n  glitchtip-valkey:')).toBeLessThan(compose.indexOf('\n  worker:'));
    expect(compose.indexOf('\n  billing:')).toBeLessThan(compose.indexOf('\nvolumes:'));
  });

  it('is how the generated README says to get a DSN', () => {
    const readme = read(reported('--broker', 'rabbitmq'), 'README.md');

    expect(readme).toContain('## Error reporting');
    expect(readme).toContain('docker compose --profile errors up -d --wait');
    expect(readme).toContain("docker compose logs glitchtip | grep 'DSN:'");
    expect(readme).toContain('Put that DSN in `SENTRY_DSN` of `.env`');

    expect(readme).toContain(
      '| an integration event given up: retries exhausted, poison message, publication of the outbox relay declared dead | a delivery that fails and is retried |',
    );

    expect(readme).toContain('tracing first, error reporting second\n(`src/platform/observability/errors.ts`)');

    expect(readme).toContain(
      '| `SENTRY_SCRUB_MESSAGES` | `true` removes the message of every reported error that is not a `DomainError`: for a tracker hosted by a third party. Left out, the message is sent with the values a failed statement quotes redacted |',
    );

    expect(readme).toContain(
      'no tenant, no\nvalue a failed statement quotes. The message of the error is sent, the statement it quotes with\nits values redacted:',
    );

    expect(read(initProject(), 'README.md')).not.toContain('Error reporting');
  });
});
