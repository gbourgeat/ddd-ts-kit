import type { ProcessDecision, ProcessManager } from '@ddd-ts-kit/kernel';

export interface {{name.pascal}}State {
  readonly id: string;
  readonly deadline: string;
  // TODO(domain): add what the next steps decide from, identifiers and values, never an aggregate.
}

const DEADLINE = 'deadline';

export class {{name.pascal}}Process implements ProcessManager<{{name.pascal}}State> {
  static readonly processName = '{{process.name}}';

  static readonly timeoutJob = '{{process.timeoutJob}}';

  static isState(value: unknown): value is {{name.pascal}}State {
    return typeof value === 'object' && value !== null && 'id' in value && 'deadline' in value;
  }

  // TODO(domain): take the event that starts the process (`ddd-ts-kit generate event-handler {{context.kebab}} <Aggregate> <Event>`, whose handler calls this step).
  started(id: string, deadline: Date, current: {{name.pascal}}State | undefined): ProcessDecision<{{name.pascal}}State> | undefined {
    if (current !== undefined) {
      return undefined;
    }

    return { state: { id, deadline: deadline.toISOString() }, timeouts: [{ name: DEADLINE, at: deadline }] };
  }

  completed(current: {{name.pascal}}State | undefined): ProcessDecision<{{name.pascal}}State> | undefined {
    return current === undefined ? undefined : { state: current, cancel: [DEADLINE], ended: true };
  }

  timedOut(name: string, current: {{name.pascal}}State): ProcessDecision<{{name.pascal}}State> | undefined {
    if (name !== DEADLINE) {
      return undefined;
    }

    // TODO(domain): send the command that answers a missed deadline, as the process: `commands: [new <UseCase>Command(systemActor({{name.pascal}}Process.processName), ...)]`.
    return { state: current, ended: true };
  }
}
