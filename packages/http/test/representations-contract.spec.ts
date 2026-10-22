import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { Representations, defineRoute } from '../src';
import { generateOpenApi } from '../src/openapi';
import { catalogRoutes } from './support/catalog';

const representations = Representations.standard();

describe('the contract of a route that answers in several media types', () => {
  const info = { title: 'Catalog', version: '1' };
  const document = generateOpenApi({ info, routes: catalogRoutes, representations });
  const operations = document.paths['/products'] ?? {};

  type Operation = {
    requestBody?: { content: object };
    responses: Record<string, { content?: object; 'x-error-codes'?: string[] } | undefined>;
  };

  const operationOf = (paths: typeof document.paths, path: string, method: string): Operation =>
    (paths[path] ?? {})[method] as Operation;

  it('lists every media type it answers in, with the schema of the response', () => {
    const content = (operations['get']?.['responses'] as Record<string, { content: Record<string, unknown> }>)['200']
      ?.content;

    expect(Object.keys(content ?? {})).toEqual(['application/json', 'application/xml', 'text/csv']);
  });

  it('lists every media type it reads a body in, and the problem types and statuses of negotiation', () => {
    const post = operationOf(document.paths, '/products', 'post');

    expect(Object.keys(post.requestBody?.content ?? {})).toEqual(['application/json', 'application/xml']);

    expect(Object.keys(post.responses['406']?.content ?? {})).toEqual([
      'application/problem+json',
      'application/problem+xml',
    ]);

    expect(post.responses['406']?.['x-error-codes']).toEqual(['NOT_ACCEPTABLE']);
    expect(post.responses['415']?.['x-error-codes']).toEqual(['UNSUPPORTED_MEDIA_TYPE']);
  });

  it('documents 406 on every route a representation writes, and 415 on every route that reads a body, declared or not', () => {
    const plain = defineRoute(
      {
        method: 'PUT',
        path: '/notes',
        operationId: 'writeNote',
        summary: 'Write a note',
        security: false,
        request: { body: zodSchema(z.object({ text: z.string() })) },
        responses: { 200: { description: 'Written.', body: zodSchema(z.object({ text: z.string() })) } },
      },
      ({ body }) => ({ status: 200, body }),
    );

    const bodiless = defineRoute(
      {
        method: 'DELETE',
        path: '/notes',
        operationId: 'clearNotes',
        summary: 'Clear',
        security: false,
        responses: { 204: { description: 'Cleared.' } },
      },
      () => ({ status: 204 }),
    );

    const negotiated = generateOpenApi({ info, routes: [plain, bodiless], representations }).paths;

    expect(operationOf(negotiated, '/notes', 'put').responses['406']?.['x-error-codes']).toEqual(['NOT_ACCEPTABLE']);

    expect(operationOf(negotiated, '/notes', 'put').responses['415']?.['x-error-codes']).toEqual([
      'UNSUPPORTED_MEDIA_TYPE',
    ]);

    expect(Object.keys(operationOf(negotiated, '/notes', 'delete').responses)).toEqual(['204']);
  });

  it('documents JSON only, and no refusal of negotiation, for a server that mounts no representations', () => {
    const plain = generateOpenApi({ info, routes: catalogRoutes }).paths;
    const post = operationOf(plain, '/products', 'post');

    expect(Object.keys(post.requestBody?.content ?? {})).toEqual(['application/json']);
    expect(Object.keys(post.responses['201']?.content ?? {})).toEqual(['application/json']);
    expect([post.responses['406'], post.responses['415']]).toEqual([undefined, undefined]);
    expect(Object.keys(post.responses['422']?.content ?? {})).toEqual(['application/problem+json']);
  });
});
