import { CliError } from './cli-error';

/**
 * The scripts of the project run through a shell on Windows, and `cmd.exe` reads the arguments
 * unescaped (`affected --run "test & calc"` would run `calc`). Windows is supported through WSL 2,
 * where the platform is `linux`: anything else is refused before a process starts.
 */
export function refuseWindowsShell(platform: NodeJS.Platform): void {
  if (platform !== 'win32') {
    return;
  }

  throw new CliError(
    'ddd-ts-kit runs the scripts of the project through a shell on Windows, which passes their arguments unescaped.',
    'Run it under WSL 2 (docs/guides/agent-sandbox.md).',
  );
}
