/** A fake adapter whose calls answer only when the test releases them. */
export class SlowGateway {
  readonly signals: (AbortSignal | undefined)[] = [];

  started = 0;

  private readonly waiting: ((value: string) => void)[] = [];

  async fetch(id: string, signal?: AbortSignal): Promise<string> {
    this.started += 1;
    this.signals.push(signal);

    const answer = await new Promise<string>((resolve) => this.waiting.push(resolve));

    return `${id}:${answer}`;
  }

  /** Every parameter optional: a call that gives none leaves the place of the signal empty. */
  async lookup(id?: string, signal?: AbortSignal): Promise<string> {
    this.signals.push(signal);

    const answer = await new Promise<string>((resolve) => this.waiting.push(resolve));

    return `${id ?? 'all'}:${answer}`;
  }

  async ping(): Promise<string> {
    return new Promise<string>((resolve) => this.waiting.push(resolve));
  }

  release(answer = 'done'): void {
    this.waiting.shift()?.(answer);
  }
}
