import type { LogFields, LogLevel, Logger, Metrics } from '@ddd-ts-kit/kernel';
import { BACKGROUND_DURATION_HISTOGRAM, BACKGROUND_RUNS_COUNTER } from '../metric-names';
import type { BackgroundJobObserver } from './background-job-observer';
import type { BackgroundJobOutcome } from './background-job-outcome';
import type { BackgroundJobRun } from './background-job-run';

export interface BackgroundJobRecorderOptions {
  readonly logger: Logger;
  readonly metrics: Metrics;
  readonly onRun?: BackgroundJobObserver;
}

/** Says what became of each attempt, to the log, the metrics and the observer. Never the message of an error. */
export class BackgroundJobRecorder {
  constructor(private readonly options: BackgroundJobRecorderOptions) {}

  record(run: BackgroundJobRun, error?: unknown): BackgroundJobRun {
    quietly(() => {
      this.measure(run);
    });

    quietly(() => {
      this.log(run, error);
    });

    quietly(() => {
      this.options.onRun?.(run, error);
    });

    return run;
  }

  /** The worker itself stumbled, claiming or reporting: it goes on, and the lease brings the job back. */
  fault(queue: string, error: unknown): void {
    quietly(() => {
      this.options.logger.error('Background jobs could not be followed', {
        queue,
        errorType: typeOf(error),
        ...codeOf(error),
      });
    });
  }

  private measure(run: BackgroundJobRun): void {
    const labels = { job: run.job, context: contextOf(run.job), status: run.outcome, error_code: run.errorCode };

    this.options.metrics.counter(BACKGROUND_RUNS_COUNTER).increment(labels);
    this.options.metrics.histogram(BACKGROUND_DURATION_HISTOGRAM).record(run.durationMs, labels);
  }

  private log(run: BackgroundJobRun, error: unknown): void {
    const level = LEVELS[run.outcome];

    if (!this.options.logger.isLevelEnabled(level)) {
      return;
    }

    const fields: LogFields = {
      job: run.job,
      jobId: run.jobId,
      context: contextOf(run.job),
      attempt: run.attempt,
      outcome: run.outcome,
      durationMs: run.durationMs,
      correlationId: run.correlationId,
      ...(run.errorCode === undefined ? {} : { errorCode: run.errorCode }),
      ...(error === undefined ? {} : { errorType: typeOf(error) }),
    };

    this.options.logger[level](`Background job ${WORDS[run.outcome]}`, fields);
  }
}

function contextOf(job: string): string {
  return job.split('.', 1).join('');
}

function typeOf(error: unknown): string {
  return error instanceof Error ? error.constructor.name : typeof error;
}

function codeOf(error: unknown): { errorCode?: string } {
  const code: unknown = typeof error === 'object' && error !== null ? Reflect.get(error, 'code') : undefined;

  return typeof code === 'string' ? { errorCode: code } : {};
}

/** What records a run must not break it: a logger, a meter or an observer that throws is left alone. */
function quietly(tell: () => void): void {
  try {
    tell();
  } catch {
    return;
  }
}

const LEVELS: Readonly<Record<BackgroundJobOutcome, LogLevel>> = {
  succeeded: 'info',
  retried: 'warn',
  dead: 'error',
  released: 'info',
  interrupted: 'warn',
};

const WORDS: Readonly<Record<BackgroundJobOutcome, string>> = {
  succeeded: 'succeeded',
  retried: 'failed: it will be tried again',
  dead: 'failed for good: it is dead',
  released: 'released: the worker stopped before it ended',
  interrupted: 'interrupted: cancelled, or claimed by another worker',
};
