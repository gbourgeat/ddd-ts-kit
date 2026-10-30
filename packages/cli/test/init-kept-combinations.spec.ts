import { describe, expect, it } from 'vitest';
import { cli, tempDir } from './helpers';

describe('init says what it keeps on a combination its defaults would not choose', () => {
  it('notes an audit trail kept in the memory of the process when audit is on with no ORM', () => {
    const result = cli(tempDir('init'), 'init', '--orm', 'none', '--audit', 'on');

    expect(result.code).toBe(0);

    expect(result.stdout).toContain(
      'note: Kept `audit: on` with `orm: none`: the entries of the audit trail live in the memory of the process and are lost when it stops, until src/platform/audit/create-audit.ts answers its TODO(platform) with an adapter of your storage; `--audit off` leaves the trail out.',
    );
  });

  it('notes forms kept with no HTTP framework to serve them', () => {
    const result = cli(tempDir('init'), 'init', '--http', 'none', '--forms', 'on');

    expect(result.code).toBe(0);

    expect(result.stdout).toContain(
      'note: Kept `forms: on` with `http: none`: no route serves a form until an HTTP framework is chosen (`init --force --http <framework>`); `--forms off` records the choice.',
    );
  });

  it('says nothing when the defaults decide: no ORM means audit off, no HTTP means forms off', () => {
    expect(cli(tempDir('init'), 'init', '--orm', 'none').stdout).not.toContain('Kept `audit');
    expect(cli(tempDir('init'), 'init', '--http', 'none').stdout).not.toContain('Kept `forms');
  });
});
