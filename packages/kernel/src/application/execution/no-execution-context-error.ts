/** A boundary forgot `ExecutionScope.run`: a wiring mistake, never a business failure. */
export class NoExecutionContextError extends Error {
  constructor() {
    super('No execution context: the boundary (route, consumer, job) must call ExecutionScope.run');
    this.name = 'NoExecutionContextError';
  }
}
