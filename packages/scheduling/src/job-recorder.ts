import type { Clock, JobOutcome, JobRun, LogFields, LogLevel, Logger, Metrics } from '@ddd-ts-kit/kernel';
import { errorCodeOf } from './errors/error-code-of.js';
import type { JobRunObserver } from './job-run-observer.js';
import { DURATION_HISTOGRAM, RUNS_COUNTER } from './metric-names.js';
import type { Occurrence } from './occurrence.js';
import type { RegisteredJob } from './registered-job.js';
import type { StartedRun } from './started-run.js';

export interface RecorderOptions {
  readonly clock: Clock;
  readonly logger: Logger;
  readonly metrics: Metrics;
  readonly onRun?: JobRunObserver;
}

interface Detail {
  readonly correlationId?: string;
  readonly failure?: { readonly error: unknown };
}

/** Says what became of each occurrence, to the log, the metrics and the observer. Never the message of an error. */
export class JobRecorder {
  constructor(private readonly options: RecorderOptions) {}

  succeeded(job: RegisteredJob, started: StartedRun): JobRun {
    return this.record(job, this.ran(job, started, 'succeeded'), { correlationId: started.correlationId });
  }

  failed(job: RegisteredJob, started: StartedRun, error: unknown): JobRun {
    const run = { ...this.ran(job, started, 'failed'), errorCode: errorCodeOf(error) };

    return this.record(job, run, { correlationId: started.correlationId, failure: { error } });
  }

  /** The occurrence could not even be started. */
  refused(job: RegisteredJob, occurrence: Occurrence, error: unknown): JobRun {
    const run: JobRun = {
      job: job.name,
      outcome: 'failed',
      scheduledAt: occurrence.scheduledAt,
      errorCode: errorCodeOf(error),
    };

    return this.record(job, run, { failure: { error } });
  }

  notRun(job: RegisteredJob, occurrence: Occurrence, outcome: Exclude<JobOutcome, 'succeeded' | 'failed'>): JobRun {
    return this.record(job, { job: job.name, outcome, scheduledAt: occurrence.scheduledAt }, {});
  }

  /** The scheduler itself stumbled while following a job: it goes on with the next occurrence. */
  fault(job: RegisteredJob, error: unknown): void {
    const fields = {
      job: job.name,
      context: contextOf(job.name),
      errorType: typeOf(error),
      errorCode: errorCodeOf(error),
    };

    quietly(() => {
      this.options.logger.error('Scheduled job could not be followed', fields);
    });
  }

  private ran(job: RegisteredJob, started: StartedRun, outcome: 'succeeded' | 'failed'): JobRun {
    const { occurrence, startedAt } = started;
    const durationMs = this.options.clock.now().getTime() - startedAt.getTime();

    return { job: job.name, outcome, scheduledAt: occurrence.scheduledAt, startedAt, durationMs };
  }

  private record(job: RegisteredJob, run: JobRun, detail: Detail): JobRun {
    const { correlationId } = detail;

    job.lastRun = run;

    quietly(() => {
      this.measure(run);
    });

    quietly(() => {
      this.log(run, detail);
    });

    quietly(() => {
      this.options.onRun?.(run, detail.failure?.error, correlationId === undefined ? {} : { correlationId });
    });

    return run;
  }

  private measure(run: JobRun): void {
    const labels = { job: run.job, context: contextOf(run.job), status: run.outcome, error_code: run.errorCode };

    this.options.metrics.counter(RUNS_COUNTER).increment(labels);

    if (run.durationMs !== undefined) {
      this.options.metrics.histogram(DURATION_HISTOGRAM).record(run.durationMs, labels);
    }
  }

  private log(run: JobRun, { correlationId, failure }: Detail): void {
    const level = LEVELS[run.outcome];

    if (!this.options.logger.isLevelEnabled(level)) {
      return;
    }

    const fields: LogFields = {
      job: run.job,
      context: contextOf(run.job),
      outcome: run.outcome,
      scheduledAt: run.scheduledAt,
      ...(run.durationMs === undefined ? {} : { durationMs: run.durationMs }),
      ...(correlationId === undefined ? {} : { correlationId }),
      ...(run.errorCode === undefined ? {} : { errorCode: run.errorCode }),
      ...(failure === undefined ? {} : { errorType: typeOf(failure.error) }),
    };

    this.options.logger[level](`Scheduled job ${WORDS[run.outcome]}`, fields);
  }
}

function contextOf(job: string): string {
  return job.split('.', 1).join('');
}

function typeOf(error: unknown): string {
  return error instanceof Error ? error.constructor.name : typeof error;
}

/** What records a run must not break it: a logger, a meter or an observer that throws is left alone. */
function quietly(tell: () => void): void {
  try {
    tell();
  } catch {
    return;
  }
}

const LEVELS: Readonly<Record<JobOutcome, LogLevel>> = {
  succeeded: 'info',
  failed: 'error',
  'skipped-overlap': 'warn',
  'skipped-locked': 'debug',
  missed: 'warn',
};

const WORDS: Readonly<Record<JobOutcome, string>> = {
  succeeded: 'succeeded',
  failed: 'failed',
  'skipped-overlap': 'skipped: the previous run is still in progress',
  'skipped-locked': 'skipped: another instance runs this occurrence',
  missed: 'missed',
};
