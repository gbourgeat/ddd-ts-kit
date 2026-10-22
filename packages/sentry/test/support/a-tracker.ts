import type { ErrorReporter } from '@ddd-ts-kit/kernel';
import { close } from '@sentry/node';
import { initSentry, type InitSentryOptions } from '../../src';
import { EnvelopeServer } from './envelope-server';

export interface Tracker {
  readonly server: EnvelopeServer;
  readonly errors: ErrorReporter;
  /** Sends what is queued, then stops the SDK and the endpoint. */
  stop(): Promise<void>;
}

/** The reporter of `initSentry` in front of a local ingestion endpoint. */
export async function aTracker(options: Omit<InitSentryOptions, 'dsn'> = {}): Promise<Tracker> {
  const server = await EnvelopeServer.listening();
  const errors = initSentry({ dsn: server.dsn, ...options });

  return {
    server,
    errors,
    async stop() {
      await close(2_000);
      await server.close();
    },
  };
}
