import { ExecutionContextBuilder } from './execution-context-builder';

const executionContextBuilder = new ExecutionContextBuilder();

/** `anExecutionContext().as(ada).ofTenant('acme').from('http').build()` */
export function anExecutionContext(): ExecutionContextBuilder {
  return executionContextBuilder;
}
