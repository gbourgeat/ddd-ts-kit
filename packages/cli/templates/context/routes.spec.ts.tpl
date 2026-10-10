import { describe, expect, it } from '{{tests.module}}';
import { InMemoryCommandBus, InMemoryQueryBus } from '@ddd-ts-kit/kernel';
import { {{context.camel}}Routes } from '{{alias.context}}/presentation/http/{{context.kebab}}.routes.js';

describe('The routes of {{context.kebab}}', () => {
  it('answer each method and path once, each under an operation of its own', () => {
    const routes = {{context.camel}}Routes(new InMemoryCommandBus(), new InMemoryQueryBus());
    const endpoints = routes.map((route) => `${route.method} ${route.path}`);
    const operations = routes.map((route) => route.operationId);

    expect(new Set(endpoints).size).toBe(endpoints.length);
    expect(new Set(operations).size).toBe(operations.length);
  });
});
