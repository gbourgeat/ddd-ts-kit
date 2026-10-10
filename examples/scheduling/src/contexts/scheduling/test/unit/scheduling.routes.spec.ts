import { describe, expect, it } from 'vitest';
import { InMemoryCommandBus, InMemoryQueryBus } from '@ddd-ts-kit/kernel';
import { schedulingRoutes } from '@/contexts/scheduling/presentation/http/scheduling.routes.js';

describe('The routes of scheduling', () => {
  it('answer each method and path once, each under an operation of its own', () => {
    const routes = schedulingRoutes(new InMemoryCommandBus(), new InMemoryQueryBus());
    const endpoints = routes.map((route) => `${route.method} ${route.path}`);
    const operations = routes.map((route) => route.operationId);

    expect(new Set(endpoints).size).toBe(endpoints.length);
    expect(new Set(operations).size).toBe(operations.length);
  });
});
