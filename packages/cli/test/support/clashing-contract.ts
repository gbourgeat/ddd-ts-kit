const ANSWER = { '200': { description: 'Done.', content: { 'application/json': { schema: { type: 'string' } } } } };

const operation = (operationId: string): Record<string, unknown> => ({ operationId, responses: ANSWER });

/**
 * A contract whose names would clash in a client generated as written: operation ids that are
 * reserved words or names of the client itself, two ids that once meant one constant, and
 * schemas named like exports of the client and like the types of an operation.
 */
export const CLASHING_CONTRACT = {
  openapi: '3.1.0',
  info: { title: 'clashes', version: '1.0.0' },
  paths: {
    '/a': { get: operation('delete'), post: operation('new'), put: operation('default') },
    '/b': { get: operation('send'), post: operation('unwrap'), put: operation('createClient') },
    '/c': { get: operation('listItems'), post: operation('list_items'), put: operation('ListItems') },
  },
  components: {
    schemas: {
      ErrorCode: { type: 'string' },
      ProblemOf: { type: 'integer' },
      List_itemsResult: { type: 'boolean' },
    },
  },
};
