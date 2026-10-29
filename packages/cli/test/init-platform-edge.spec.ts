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
