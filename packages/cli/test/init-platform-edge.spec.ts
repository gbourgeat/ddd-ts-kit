import { describe, expect, it } from 'vitest';
import { read } from './helpers';
import { initProject } from './support/init-project';

describe('the HTTP server init writes answers what fails at its edge', () => {
  it.each([
    ['express', 'app.use(problemErrorHandler({ logger: served.logger }));'],
    ['fastify', 'app.setErrorHandler(problemErrorHandler({ logger: served.logger }));'],
    ['hono', 'app.onError(problemErrorHandler({ logger: served.logger }));'],
    ['nest', 'app.useGlobalFilters(new ProblemExceptionFilter(app.getHttpAdapter(), { logger: served.logger }));'],
  ])('answers what %s refuses before a route as a problem, logged without the body', (http, installed) => {
    const server = read(initProject('--http', http), 'src/platform/http/start-http-server.ts');

    expect(server).toContain(installed);
  });

  it.each([
    ['express', 'app.use(problemNotFoundHandler({ logger: served.logger }));'],
    ['fastify', 'app.setNotFoundHandler(problemNotFoundHandler({ logger: served.logger }));'],
    ['hono', 'app.notFound(problemNotFoundHandler({ logger: served.logger }));'],
  ])('answers a path no route of %s serves 404 as a problem, as the filter of Nest does', (http, installed) => {
    const server = read(initProject('--http', http), 'src/platform/http/start-http-server.ts');

    expect(server).toContain(installed);
  });

  it('answers a path no route serves on Express after every route, before the handler of errors', () => {
    const server = read(initProject('--docs-ui', 'scalar'), 'src/platform/http/start-http-server.ts');

    expect(server.indexOf('mountExpress(app, withDocumentation(')).toBeLessThan(
      server.indexOf('app.use(problemNotFoundHandler('),
    );

    expect(server.indexOf('app.use(problemNotFoundHandler(')).toBeLessThan(
      server.indexOf('app.use(problemErrorHandler('),
    );
  });

  it('fails the start on Express when the port cannot be bound, instead of answering a server that serves nothing', () => {
    const server = read(initProject(), 'src/platform/http/start-http-server.ts');

    expect(server).toContain(
      'const server = app.listen(port, (error) => (error === undefined ? resolve(server) : reject(error)));',
    );
  });

  it('answers a failed limit of the callers as a problem, on Express and on Nest', () => {
    const express = read(initProject('--cache', 'redis'), 'src/platform/http/start-http-server.ts');
    const nest = read(initProject('--http', 'nest', '--cache', 'redis'), 'src/platform/http/start-http-server.ts');

    expect(express.indexOf('limitEachCaller(app, served, config);')).toBeLessThan(
      express.indexOf('app.use(problemErrorHandler('),
    );

    expect(express).toContain('}, next);');
    expect(nest.match(/\}, next\);/g)).toHaveLength(2);
  });

  it.each([
    ['express', 'function answerReadiness(', '}, next);'],
    ['nest', 'function answeringReadiness(', '}, next);'],
    // An async handler: Fastify and Hono pass its rejection to their error handler.
    [
      'fastify',
      'function answerReadiness(',
      "app.get('/health/ready', async (_request, reply) => {\n    const ready = await served.ready();",
    ],
    [
      'hono',
      'function answerReadiness(',
      "app.get('/health/ready', async (context) => {\n    const ready = await served.ready();",
    ],
  ])(
    'answers a readiness probe that fails as a problem, through the error handler of %s',
    (http, declared, handled) => {
      const server = read(initProject('--http', http, '--cache', 'redis'), 'src/platform/http/start-http-server.ts');
      const start = server.indexOf(declared);
      const probe = server.slice(start, server.indexOf('\n}\n', start));

      expect(start).toBeGreaterThan(-1);
      expect(probe).toContain(handled);
    },
  );
});
