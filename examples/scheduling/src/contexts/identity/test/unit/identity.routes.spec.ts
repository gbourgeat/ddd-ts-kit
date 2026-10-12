import { describe, expect, it } from 'vitest';
import { InMemoryCommandBus, InMemoryQueryBus } from '@ddd-ts-kit/kernel';
import { identityRoutes } from '@/contexts/identity/presentation/http/identity.routes';

describe('The routes of identity', () => {
  it('answer each method and path once, each under an operation of its own', () => {
    const routes = identityRoutes(new InMemoryCommandBus(), new InMemoryQueryBus());
    const endpoints = routes.map((route) => `${route.method} ${route.path}`);
    const operations = routes.map((route) => route.operationId);

    expect(new Set(endpoints).size).toBe(endpoints.length);
    expect(new Set(operations).size).toBe(operations.length);
  });
});
