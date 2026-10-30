import { describe, expect, it } from 'vitest';
import { CliError } from '../src/cli-error';
import { refuseWindowsShell } from '../src/refuse-windows-shell';

describe('refuseWindowsShell', () => {
  it('refuses win32 with exit code 2, the reason and WSL 2 as the way out', () => {
    let refusal: unknown;

    try {
      refuseWindowsShell('win32');
    } catch (error) {
      refusal = error;
    }

    expect(refusal).toBeInstanceOf(CliError);

    expect(refusal).toMatchObject({
      exitCode: 2,
      message: expect.stringContaining('passes their arguments unescaped'),
      fix: expect.stringContaining('WSL 2'),
    });
  });

  it.each(['linux', 'darwin'] as const)('does nothing on %s, which is also what WSL reports', (platform) => {
    expect(() => refuseWindowsShell(platform)).not.toThrow();
  });
});
