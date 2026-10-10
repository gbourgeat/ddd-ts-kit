import { describe, expect, it } from 'vitest';
import { InMemoryCommandBus, InMemoryQueryBus } from '@ddd-ts-kit/kernel';
import { analyticsRoutes } from '@/contexts/analytics/presentation/http/analytics.routes.js';

describe('The routes of analytics', () => {
  it('answer each method and path once, each under an operation of its own', () => {
    const routes = analyticsRoutes(new InMemoryCommandBus(), new InMemoryQueryBus());
    const endpoints = routes.map((route) => `${route.method} ${route.path}`);
    const operations = routes.map((route) => route.operationId);

    expect(new Set(endpoints).size).toBe(endpoints.length);
    expect(new Set(operations).size).toBe(operations.length);
  });
});
