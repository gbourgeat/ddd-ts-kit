import { spawn, type ChildProcess } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { read, scaffoldEverything, tempDir, write } from '../helpers.js';
import { installAsPublished } from './install-as-published.js';
import { SLOW } from './stacks.js';

const BILLING = 'src/contexts/billing';
const BARREL = `${BILLING}/billing.declarations.ts`;
const HANDLER = `${BILLING}/application/commands/cancel-invoice/cancel-invoice.handler.ts`;
const HANDLER_ALIAS = '@/contexts/billing/application/commands/cancel-invoice/cancel-invoice.handler';
const PATIENCE_MS = 60_000;
const SETTLE_MS = 3_000;

/** What the process printed so far, and the process, to stop it with everything it started. */
interface Watched {
  readonly process: ChildProcess;
  output: string;
}

/**
 * Slow, opt-in (DDD_TS_KIT_E2E=1): in development the injected list follows the code without a
 * manual step. `npm run dev` of a project of the default stack runs under `tsx watch`, which
 * emits no decorator metadata; a port added to the constructor of a handler and saved is
 * injected in the process the watcher starts next, because that process rewrites the
 * generated declarations before it loads the application.
 */
describe.runIf(SLOW)('npm run dev, when a dependency is added to a constructor', () => {
  let root: string;
  let watched: Watched | undefined;

  beforeAll(() => {
    root = tempDir('dev-reload');
    scaffoldEverything(root);
    installAsPublished(root);
    write(root, '.env', read(root, '.env.example'));

    // The probe: the composition root is asked for the handler before anything listens, and says what the handler was given.
    write(
      root,
      'src/main.ts',
      read(root, 'src/main.ts')
        .replace(
          'import { composeApplication } from',
          `import { CancelInvoiceHandler } from '${HANDLER_ALIAS}';\nimport { composeApplication } from`,
        )
        .replace(
          'await application.start();',
          'console.log(`PROBE ${application.container.resolve(CancelInvoiceHandler).probe()}`);\n\nawait application.start();',
        ),
    );
  }, 120_000);

  afterAll(() => {
    if (watched?.process.pid !== undefined) {
      process.kill(-watched.process.pid, 'SIGKILL');
    }
  });

  it(
    'reloads with the port injected, the generated barrel rewritten by the reload itself',
    async () => {
      const generated = read(root, HANDLER);

      write(root, HANDLER, probed(generated, '', "'given nothing'"));
      watched = watch(root);

      await printed(watched, 'PROBE given nothing');

      expect(read(root, BARREL)).not.toContain('injected(CancelInvoiceHandler');

      // The watcher starts watching a file some time after the process loaded it: nobody saves within that instant.
      await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));

      write(
        root,
        HANDLER,
        `import type { Clock } from '@ddd-ts-kit/kernel';\n${probed(
          generated,
          '  constructor(private readonly clock: Clock) {}\n\n',
          '`given a clock that reads ${typeof this.clock.now()}`',
        )}`,
      );

      await printed(watched, 'PROBE given a clock that reads object');

      expect(watched.output).toContain(`ddd-ts-kit: rewrote ${BARREL} from the role files and their constructors`);
      expect(read(root, BARREL)).toContain('injected(CancelInvoiceHandler, [Clock]);');
      expect(watched.output).not.toContain('MISSING_DEPENDENCIES');
    },
    2 * PATIENCE_MS + 30_000,
  );
});

function watch(root: string): Watched {
  const child = spawn('npm', ['run', 'dev'], {
    cwd: root,
    detached: true,
    env: { ...process.env, OTEL_SDK_DISABLED: 'true', NO_COLOR: '1' },
  });

  const watched: Watched = { process: child, output: '' };

  for (const stream of [child.stdout, child.stderr]) {
    stream.on('data', (chunk: Buffer) => {
      watched.output += chunk.toString('utf8');
    });
  }

  return watched;
}

/** Waits until the process printed `text`, and fails with everything it printed when it did not in time. */
async function printed(watched: Watched, text: string): Promise<void> {
  const deadline = Date.now() + PATIENCE_MS;

  while (!watched.output.includes(text)) {
    if (Date.now() > deadline) {
      throw new Error(`"${text}" was not printed within ${PATIENCE_MS} ms:\n${watched.output}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

/** The handler as generated, with a method the probe of `main.ts` calls, and what it is given. */
function probed(handler: string, constructorLines: string, answer: string): string {
  return handler.replace(
    /(export class CancelInvoiceHandler [^{]*\{\n)/,
    `$1${constructorLines}  probe(): string {\n    return ${answer};\n  }\n\n`,
  );
}
