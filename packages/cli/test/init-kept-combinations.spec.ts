import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cli, tempDir } from './helpers';

describe('init says what it keeps on a combination its defaults would not choose', () => {
  it('notes an audit trail kept in the memory of the process when audit is on with no ORM', () => {
    const result = cli(tempDir('init'), 'init', '--orm', 'none', '--audit', 'on');

    expect(result.code).toBe(0);

    expect(result.stdout).toContain(
      'note: Kept `audit: on` with `orm: none`: the entries of the audit trail live in the memory of the process and are lost when it stops, until src/platform/audit/create-audit-trail.ts answers its TODO(platform) with an adapter of your storage; `npx ddd-ts-kit init --force --audit off` leaves the trail out.',
    );
  });

  it('notes forms kept with no HTTP framework to serve them', () => {
    const result = cli(tempDir('init'), 'init', '--http', 'none', '--forms', 'on');

    expect(result.code).toBe(0);

    expect(result.stdout).toContain(
      'note: Kept `forms: on` with `http: none`: no route serves a form until an HTTP framework is chosen (`npx ddd-ts-kit init --force --http <framework>`); `npx ddd-ts-kit init --force --forms off` records the choice.',
    );
  });

  it('says nothing when the defaults decide: no ORM means audit off, no HTTP means forms off', () => {
    expect(cli(tempDir('init'), 'init', '--orm', 'none').stdout).not.toContain('Kept `audit');
    expect(cli(tempDir('init'), 'init', '--http', 'none').stdout).not.toContain('Kept `forms');
  });
});

describe('init run again on a project keeps its stack and says which flag it did not apply', () => {
  const initialised = (): string => {
    const dir = tempDir('init');

    cli(dir, 'init');

    return dir;
  };

  it('notes a flag that differs from the recorded stack, and changes nothing', () => {
    const dir = initialised();
    const result = cli(dir, 'init', '--http', 'fastify');

    expect(result.code).toBe(0);

    expect(result.stdout).toContain(
      'note: `--http fastify` is kept as recorded (express): `npx ddd-ts-kit init --force --http fastify` changes it.',
    );

    expect(fs.readFileSync(path.join(dir, 'ddd-ts-kit.config.json'), 'utf8')).toContain('"http": "express"');
  });

  it('refuses a value no flag accepts, as it does in an empty directory', () => {
    const result = cli(initialised(), 'init', '--http', 'nope');

    expect(result.code).toBe(2);

    expect(result.stderr).toContain('Unknown value "nope" for --http.');
  });

  it('says nothing of a flag that repeats the record', () => {
    expect(cli(initialised(), 'init', '--http', 'express').stdout).not.toContain('is kept as recorded');
  });
});

describe('init says what a choice does not do', () => {
  it('notes the events of an event-sourced aggregate kept in memory when there is no ORM', () => {
    const result = cli(tempDir('init'), 'init', '--orm', 'none', '--event-sourcing', 'on');

    expect(result.code).toBe(0);

    expect(result.stdout).toContain('note: Kept `eventSourcing: on` with `orm: none`');
    expect(result.stdout).toContain('InMemoryEventStore');
  });

  it('refuses a reason for leaving the outbox out when the stack keeps it', () => {
    const result = cli(tempDir('init'), 'init', '--allow-no-outbox', 'no need');

    expect(result.code).toBe(2);

    expect(result.stderr).toContain(
      '--allow-no-outbox records nothing on this stack (--orm drizzle, --events outbox).',
    );
  });
});
