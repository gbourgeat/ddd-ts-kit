import { execFile } from 'node:child_process';
import { createServer } from 'node:net';
import { promisify } from 'node:util';

const run = promisify(execFile);

export interface ThrowawayJaeger {
  /** Base URL of the OTLP/HTTP receiver, for `OTEL_EXPORTER_OTLP_ENDPOINT`. */
  readonly otlpUrl: string;
  /** Base URL of the query API and of the interface. */
  readonly queryUrl: string;
  /** Removes the container, by its name. */
  remove(): Promise<void>;
}

/**
 * Starts a Jaeger all-in-one of its own for one spec: a container named
 * `ddd-ts-kit-test-trace-jaeger-<pid>`, bound to the loopback interface on two free ports,
 * keeping its traces in memory. Nothing else on the machine is touched.
 */
export async function startThrowawayJaeger(image: string): Promise<ThrowawayJaeger> {
  const name = `ddd-ts-kit-test-trace-jaeger-${process.pid}`;
  const [otlpPort, queryPort] = [await freePort(), await freePort()];
  const ports = ['-p', `127.0.0.1:${otlpPort}:4318`, '-p', `127.0.0.1:${queryPort}:16686`];

  await run('docker', ['run', '-d', '--rm', '--name', name, ...ports, image]);

  const jaeger = {
    otlpUrl: `http://127.0.0.1:${otlpPort}`,
    queryUrl: `http://127.0.0.1:${queryPort}`,
    remove: async (): Promise<void> => void (await run('docker', ['rm', '-f', name])),
  };

  try {
    await answering(`${jaeger.queryUrl}/api/v3/services`);
  } catch (error) {
    await jaeger.remove();

    throw error;
  }

  return jaeger;
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();

    server.once('error', reject);

    server.listen(0, '127.0.0.1', () => {
      const address = server.address();

      server.close(() => {
        if (typeof address === 'object' && address !== null) resolve(address.port);
        else reject(new Error('no free port'));
      });
    });
  });
}

async function answering(url: string): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const up = await fetch(url).then(
      (response) => response.ok,
      () => false,
    );

    if (up) return;

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(`Jaeger did not answer at ${url}`);
}
