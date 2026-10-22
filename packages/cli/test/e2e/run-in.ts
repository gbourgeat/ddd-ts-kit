import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { REPO_ROOT } from '../helpers';

/** Real services are named by the environment of this run; without them the generated projects stay in the process. */
const SERVICES = {
  AMQP_URL: process.env['DDD_TS_KIT_TEST_AMQP_URL'] ?? '',
  REDIS_URL: process.env['DDD_TS_KIT_TEST_REDIS_URL'] ?? '',
  KAFKA_BROKERS: process.env['DDD_TS_KIT_TEST_KAFKA_BROKERS'] ?? '',
  NATS_URL: process.env['DDD_TS_KIT_TEST_NATS_URL'] ?? '',
};

const QUIET = { DATABASE_URL: '', OTEL_SDK_DISABLED: 'true', NO_COLOR: '1', FORCE_COLOR: '0' };

export interface Invocation {
  readonly command: string;
  readonly args: readonly string[];
  readonly env?: Readonly<Record<string, string>>;
}

/** A binary of the workspace, as a script of a generated project finds it in its own node_modules. */
export function bin(name: string): string {
  return path.join(REPO_ROOT, 'node_modules/.bin', name);
}

/** Runs a command in a generated project and answers what it printed; a failure carries both streams. */
export function runIn(root: string, { command, args, env = {} }: Invocation): string {
  try {
    return execFileSync(command, [...args], {
      cwd: root,
      encoding: 'utf8',
      stdio: 'pipe',
      env: { ...process.env, ...QUIET, ...SERVICES, ...env },
    });
  } catch (error) {
    const output =
      error instanceof Error && 'stdout' in error
        ? `${String(error.stdout)}\n${String(Reflect.get(error, 'stderr'))}`
        : String(error);

    throw new Error(`${command} ${args.join(' ')} failed:\n${output}`, { cause: error });
  }
}

/** What a command prints when it fails, or an empty string when it passes. */
export function findingsOf(root: string, invocation: Invocation): string {
  try {
    runIn(root, invocation);

    return '';
  } catch (error) {
    return String(error);
  }
}
