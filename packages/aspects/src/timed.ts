import type { Clock, MetricLabels, Metrics } from '@ddd-ts-kit/kernel';
import { defineAspect } from './aspect.js';
import type { AdviceFactory, Aspect, JoinPoint } from './types.js';
import { observed } from './observe.js';
import { clockOr, metricsOr } from './runtime.js';

export interface TimedOptions {
  /** Prefix of the two series: `<name>_duration_ms` and `<name>_total`. Default `dependency_call`. */
  readonly name?: string;
  /** Defaults to the metrics of the aspect runtime. */
  readonly metrics?: Metrics;
  /** Defaults to the clock of the aspect runtime. */
  readonly clock?: Clock;
}

const DEFAULT_NAME = 'dependency_call';

/**
 * Per call: a duration in the histogram `<name>_duration_ms` and one in the counter
 * `<name>_total`, labelled `class`, `method`, `kind`, `context`, `outcome`, and `error_code`
 * on a failure that has one. Labels are names from the code, never values of a call.
 */
export function timed(options: TimedOptions = {}): Aspect {
  return defineAspect(timedAdvice(options));
}

export function timedAdvice(options: TimedOptions = {}): AdviceFactory {
  return (joinPoint) => {
    const labels = subjectLabels(joinPoint);
    return ({ proceed }) =>
      timeCall(
        {
          metrics: metricsOr(options.metrics),
          clock: clockOr(options.clock),
          name: options.name ?? DEFAULT_NAME,
          labels,
        },
        proceed,
      );
  };
}

export interface TimedCall {
  readonly metrics: Metrics;
  readonly clock: Clock;
  readonly name: string;
  readonly labels: MetricLabels;
}

export function timeCall<T>(call: TimedCall, proceed: () => Promise<T>): Promise<T> {
  const { metrics, name, labels } = call;
  return observed(call.clock, proceed, ({ durationMs, error }) => {
    const outcome = error === undefined ? 'success' : 'failure';
    metrics.histogram(`${name}_duration_ms`).record(durationMs, { ...labels, outcome });
    metrics.counter(`${name}_total`).increment({ ...labels, outcome, error_code: error?.errorCode });
  });
}

function subjectLabels(joinPoint: JoinPoint): MetricLabels {
  return {
    class: joinPoint.className,
    method: joinPoint.method,
    kind: joinPoint.kind,
    context: joinPoint.context,
  };
}
