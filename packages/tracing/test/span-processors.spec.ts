import { trace } from '@opentelemetry/api';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ErrorMessageScrubber, UrlSecretSpanProcessor } from '../src';
import { setupTracing, type TestTracing } from './support/setup-tracing';

let tracing: TestTracing;

beforeEach(() => {
  tracing = setupTracing([new UrlSecretSpanProcessor(), new ErrorMessageScrubber()]);
});

afterEach(() => tracing.teardown());

function exportedAttribute(key: string, value: string): unknown {
  const span = trace.getTracer('test').startSpan('GET');

  span.setAttribute(key, value);
  span.end();

  return tracing.span('GET').attributes[key];
}

describe('UrlSecretSpanProcessor', () => {
  it.each([
    [
      'url.full',
      'https://api.example.org/pay?token=s3cr3t&amount=12#frag',
      'https://api.example.org/pay?token=REDACTED&amount=REDACTED#frag',
    ],
    [
      'http.url',
      'https://alice:hunter2@api.example.org/pay?flag&key=abc',
      'https://REDACTED:REDACTED@api.example.org/pay?flag&key=REDACTED',
    ],
    ['url.full', '/relative/path?sig=abc==', '/relative/path?sig=REDACTED'],
    ['url.full', 'https://api.example.org/users/a@b', 'https://api.example.org/users/a@b'],
    ['url.query', 'token=s3cr3t&page=2', 'token=REDACTED&page=REDACTED'],
    ['url.query', '?token=s3cr3t', '?token=REDACTED'],
  ])('redacts %s %s', (key, recorded, expected) => {
    expect(exportedAttribute(key, recorded)).toBe(expected);
  });

  it('leaves other attributes alone', () => {
    expect(exportedAttribute('url.path', '/pay?x=1')).toBe('/pay?x=1');
  });
});

describe('ErrorMessageScrubber', () => {
  it('keeps the exception type and removes its message, stack trace and status message', () => {
    const span = trace.getTracer('test').startSpan('query');

    span.recordException(new TypeError('duplicate key jane@example.org'));
    span.setStatus({ code: 2, message: 'duplicate key jane@example.org' });
    span.end();

    const exported = tracing.span('query');

    expect(exported.events[0]?.attributes).toEqual({ 'exception.type': 'TypeError' });
    expect(exported.status).toEqual({ code: 2 });
    expect(JSON.stringify([exported.events, exported.status])).not.toContain('jane');
  });

  it('leaves an event that carries no attributes as it is', () => {
    const ended = {
      attributes: {},
      events: [{}, { attributes: { 'exception.message': 'secret' } }],
      status: { code: 2 },
    };

    new ErrorMessageScrubber().onEnd(ended);

    expect(ended.events).toEqual([{}, { attributes: {} }]);
  });
});
