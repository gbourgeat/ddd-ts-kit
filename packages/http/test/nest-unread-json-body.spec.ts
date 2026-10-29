import { BadRequestException, HttpException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { isUnreadJsonBody } from '../src/nest/is-unread-json-body';

const unread = { headers: { 'content-type': 'application/json; charset=utf-8' }, body: undefined };

describe('a body Nest could not read as JSON', () => {
  it('is told by what Nest leaves of the error of its parser, over Express and over Fastify', () => {
    const overExpress = new BadRequestException('Expected double-quoted property name in JSON at position 34');
    const overFastify = new HttpException("Body is not valid JSON but content-type is set to 'application/json'", 400);

    expect([isUnreadJsonBody(overExpress, unread), isUnreadJsonBody(overFastify, unread)]).toEqual([true, true]);
  });

  it.each([
    ['a refusal of a controller, whose body was read', 'Invalid JSON pointer', { ...unread, body: {} }],
    ['a path parameter Express could not decode', "Failed to decode param '%FF'", unread],
    ['a body in another media type', 'Unexpected end of JSON input', { headers: { 'content-type': 'text/plain' } }],
    ['a request with no media type', 'Unexpected end of JSON input', { headers: {} }],
    ['a request Nest does not describe', 'Unexpected end of JSON input', undefined],
  ])('is not %s', (_case, message, request) => {
    expect(isUnreadJsonBody(new BadRequestException(message), request)).toBe(false);
  });

  it('is not another status, nor an error with no message', () => {
    expect(isUnreadJsonBody(new HttpException('Unexpected end of JSON input', 413), unread)).toBe(false);
    expect(isUnreadJsonBody({ status: 400 }, unread)).toBe(false);
  });
});
