import type { RepresentedBody } from '../representation/represented-body.js';
import type { RepresentedAnswer } from './represented-answer.js';

const encoder = new TextEncoder();

/** What a representation wrote, as an answer under its media type: bytes at once, or chunks. */
export function writtenAs(written: RepresentedBody, mediaType: string): RepresentedAnswer {
  const headers = { 'content-type': `${mediaType}; charset=utf-8` };

  return typeof written === 'string' ? { headers, body: encoder.encode(written) } : { headers, stream: written };
}
