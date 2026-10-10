export type MetricKind = 'counter' | 'histogram' | 'gauge';

export interface MetricSample {
  readonly kind: MetricKind;
  readonly name: string;
  readonly value: number;
  readonly labels: Readonly<Record<string, string>>;
}
