import type { TraceStep } from './trace-step';

/**
 * The lines of an explanation, written as the questions are asked: `yes` answers true and `no`
 * answers false, so that a check reads `return trace.no('clerk grants nothing')`.
 */
export class Trace {
  private readonly steps: TraceStep[] = [];

  get lines(): readonly TraceStep[] {
    return this.steps;
  }

  yes(text: string, depth = 0): true {
    this.steps.push({ depth, text, answer: 'yes' });

    return true;
  }

  no(text: string, depth = 0): false {
    this.steps.push({ depth, text, answer: 'no' });

    return false;
  }

  /** The lines of the model this one asked, one level deeper. */
  include(lines: readonly TraceStep[]): void {
    for (const line of lines) {
      this.steps.push({ ...line, depth: line.depth + 1 });
    }
  }
}
