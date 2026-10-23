import { z } from 'zod';
import { AsyncLocalStorageExecutionScope } from '@ddd-ts-kit/kernel';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { defineRoute } from '../../src';

export const executionScope = new AsyncLocalStorageExecutionScope();

/** Answers what infrastructure would read from the execution scope while the handler runs. */
export const readExecution = defineRoute(
  {
    method: 'GET',
    path: '/execution',
    operationId: 'readExecution',
    summary: 'Read the execution context of the request',
    responses: {
      200: {
        description: 'The execution context.',
        body: zodSchema(z.object({ correlationId: z.string(), origin: z.string(), sameAsHanded: z.boolean() })),
      },
    },
    security: false,
  },
  async ({ context }) => {
    // After an asynchronous hop, as a repository would be: the scope must have followed.
    await new Promise((resolve) => setImmediate(resolve));
    const ambient = executionScope.require();

    return {
      status: 200,
      body: {
        correlationId: ambient.correlationId,
        origin: ambient.origin,
        sameAsHanded: ambient === context.execution,
      },
    };
  },
);
