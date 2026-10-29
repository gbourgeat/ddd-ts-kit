import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Io } from '../src/commands/io';
import { ISSUES_URL } from '../src/issues-url';
import { run } from '../src/run';
import { VERSION } from '../src/version';
import { cli, tempDir } from './helpers';

/** A terminal that fails on the first line written to it, as a closed pipe does, and keeps the next ones. */
function terminalFailingOnce(): { io: Io; out: string[]; err: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  let failed = false;

  const io: Io = {
    out: (text) => {
      if (!failed) {
        failed = true;
        throw new TypeError('the terminal is gone');
      }

      out.push(text);
    },
    err: (text) => void err.push(text),
  };

  return { io, out, err };
}

describe('the commands of ddd-ts-kit', () => {
  it.each(['constructor', 'prototype', '__proto__', 'toString', 'hasOwnProperty', 'valueOf'])(
    'take %s for an unknown command, which exits 2 with the commands it knows',
    (name) => {
      const unknown = cli(tempDir('run'), name);

      expect(unknown.code).toBe(2);
      expect(unknown.stderr).toContain(`error: Unknown command "${name}".`);
      expect(unknown.stderr).toContain('fix: Use one of: affected, init, generate');
    },
  );
});

describe('an internal error of ddd-ts-kit', () => {
  it('says the version and where to report it with the command in one line, and exits 4', () => {
    const terminal = terminalFailingOnce();

    delete process.env['DDD_TS_KIT_DEBUG'];

    const code = run(['--version'], terminal.io);

    expect(code).toBe(4);

    expect(terminal.err).toEqual([
      `internal error of ddd-ts-kit ${VERSION}: the terminal is gone; please report it at ${ISSUES_URL} with the command: ddd-ts-kit --version`,
    ]);
  });

  it('is JSON under --json, marked internal', () => {
    const terminal = terminalFailingOnce();

    const code = run(['--version', '--json'], terminal.io);

    expect(code).toBe(4);

    expect(JSON.parse(terminal.out.join('\n'))).toEqual({
      error: {
        message: `internal error of ddd-ts-kit ${VERSION}: the terminal is gone`,
        fix: `Please report it at ${ISSUES_URL} with the command: ddd-ts-kit --version --json`,
        stack: expect.stringMatching(/^TypeError: the terminal is gone\n {4}at /),
      },
      internal: true,
    });
  });

  it('prints its stack trace after the line when DDD_TS_KIT_DEBUG is set, for the report to say where', () => {
    const terminal = terminalFailingOnce();

    process.env['DDD_TS_KIT_DEBUG'] = '1';

    try {
      expect(run(['--version'], terminal.io)).toBe(4);
    } finally {
      delete process.env['DDD_TS_KIT_DEBUG'];
    }

    const [line, stack] = terminal.err;

    expect(line).toContain(`internal error of ddd-ts-kit ${VERSION}: the terminal is gone; please report it`);
    expect(stack).toMatch(/^TypeError: the terminal is gone\n {4}at /);
    expect(terminal.err).toHaveLength(2);
  });

  it('is reported where the package says its issues are', () => {
    const manifest: { bugs: string } = JSON.parse(
      fs.readFileSync(path.join(import.meta.dirname, '../package.json'), 'utf8'),
    );

    expect(ISSUES_URL).toBe(manifest.bugs);
  });
});
