import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { Incoming } from './incoming';
import { S3Error } from './s3-error';

const ALGORITHM = 'AWS4-HMAC-SHA256';
const UNSIGNED_PAYLOAD = 'UNSIGNED-PAYLOAD';
const MAX_EXPIRY_SECONDS = 604_800;
const MAX_SKEW_MS = 15 * 60_000;

export interface Credentials {
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
}

/** What a request signs, read from its `Authorization` header or from the query of a signed link. */
interface Signed {
  readonly credential: string;
  readonly signedHeaders: readonly string[];
  readonly signature: string;
  readonly amzDate: string;
  readonly payloadHash: string;
  /** For a signed link: the seconds it is valid for after `amzDate`. */
  readonly expiresInSeconds?: number;
}

/**
 * Checks the AWS Signature Version 4 of a request as S3 does: the key it names, the time it was
 * signed at (a link no longer valid is refused, a header signature too far from the clock as
 * well), the signature of the canonical request, and for a signed payload, the hash of the body.
 */
export function verifySignature(request: Incoming, credentials: Credentials, now: Date): void {
  const signed = request.query.has('X-Amz-Signature') ? fromQuery(request) : fromHeader(request);
  const [accessKeyId = '', date = '', region = '', service = '', terminator = ''] = signed.credential.split('/');

  if (accessKeyId !== credentials.accessKeyId) {
    throw new S3Error(403, 'InvalidAccessKeyId', 'The Access Key Id you provided does not exist in our records.');
  }

  if (!signed.amzDate.startsWith(date) || service !== 's3' || terminator !== 'aws4_request') {
    throw new S3Error(400, 'AuthorizationHeaderMalformed', 'The authorization header is malformed.');
  }

  checkTime(signed, now);

  const scope = [date, region, service, terminator].join('/');
  const canonical = canonicalRequest(request, signed);
  const toSign = [ALGORITHM, signed.amzDate, scope, sha256(canonical)].join('\n');
  const expected = hmac(signingKey(credentials.secretAccessKey, date, region, service), toSign).toString('hex');

  if (!sameText(expected, signed.signature)) {
    throw S3Error.signatureDoesNotMatch();
  }

  if (signed.payloadHash !== UNSIGNED_PAYLOAD && signed.payloadHash !== sha256(request.body)) {
    throw new S3Error(400, 'XAmzContentSHA256Mismatch', 'The provided x-amz-content-sha256 does not match the body.');
  }
}

function fromHeader(request: Incoming): Signed {
  const authorization = request.headers['authorization'] ?? '';

  if (!authorization.startsWith(`${ALGORITHM} `)) {
    throw S3Error.accessDenied('Access Denied.');
  }

  const fields = new Map<string, string>();

  for (const field of authorization.slice(ALGORITHM.length + 1).split(',')) {
    const [name = '', value = ''] = field.trim().split('=');

    fields.set(name, value);
  }

  return {
    credential: fields.get('Credential') ?? '',
    signedHeaders: (fields.get('SignedHeaders') ?? '').split(';'),
    signature: fields.get('Signature') ?? '',
    amzDate: request.headers['x-amz-date'] ?? '',
    payloadHash: request.headers['x-amz-content-sha256'] ?? '',
  };
}

function fromQuery(request: Incoming): Signed {
  const query = request.query;

  if (query.get('X-Amz-Algorithm') !== ALGORITHM) {
    throw new S3Error(400, 'AuthorizationQueryParametersError', 'X-Amz-Algorithm only supports "AWS4-HMAC-SHA256".');
  }

  const expiresInSeconds = Number(query.get('X-Amz-Expires'));

  if (!Number.isInteger(expiresInSeconds) || expiresInSeconds < 1 || expiresInSeconds > MAX_EXPIRY_SECONDS) {
    throw new S3Error(400, 'AuthorizationQueryParametersError', 'X-Amz-Expires must be between 1 and 604800.');
  }

  return {
    credential: query.get('X-Amz-Credential') ?? '',
    signedHeaders: (query.get('X-Amz-SignedHeaders') ?? '').split(';'),
    signature: query.get('X-Amz-Signature') ?? '',
    amzDate: query.get('X-Amz-Date') ?? '',
    payloadHash: query.get('X-Amz-Content-Sha256') ?? UNSIGNED_PAYLOAD,
    expiresInSeconds,
  };
}

function checkTime(signed: Signed, now: Date): void {
  const signedAt = dateOf(signed.amzDate);

  if (signed.expiresInSeconds === undefined) {
    if (Math.abs(now.getTime() - signedAt) > MAX_SKEW_MS) {
      throw new S3Error(
        403,
        'RequestTimeTooSkewed',
        'The difference between the request time and the server time is too large.',
      );
    }

    return;
  }

  if (now.getTime() > signedAt + signed.expiresInSeconds * 1_000) {
    throw S3Error.accessDenied('Request has expired');
  }
}

/** `20261023T125928Z`, the basic ISO 8601 form of `X-Amz-Date`, in milliseconds. */
function dateOf(amzDate: string): number {
  const parts = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(amzDate);

  if (parts === null) {
    throw new S3Error(403, 'AccessDenied', 'X-Amz-Date is not a date.');
  }

  const [, year, month, day, hours, minutes, seconds] = parts.map(Number);

  return Date.UTC(year ?? 0, (month ?? 1) - 1, day, hours, minutes, seconds);
}

function canonicalRequest(request: Incoming, signed: Signed): string {
  const headers = signed.signedHeaders.map((name) => `${name}:${headerValue(request, name)}\n`).join('');

  return [
    request.method,
    request.rawPath,
    canonicalQuery(request.rawQuery),
    headers,
    signed.signedHeaders.join(';'),
    signed.payloadHash,
  ].join('\n');
}

function headerValue(request: Incoming, name: string): string {
  return (request.headers[name] ?? '').trim().replace(/\s+/g, ' ');
}

/** Every parameter but the signature, each name and value encoded as RFC 3986 says, sorted. */
function canonicalQuery(rawQuery: string): string {
  return rawQuery
    .split('&')
    .filter((pair) => pair !== '')
    .map((pair) => {
      const mark = pair.indexOf('=');
      const name = decodeURIComponent(mark === -1 ? pair : pair.slice(0, mark));
      const value = mark === -1 ? '' : decodeURIComponent(pair.slice(mark + 1));

      return [escape(name), escape(value)] as const;
    })
    .filter(([name]) => name !== 'X-Amz-Signature')
    .sort(([left, leftValue], [right, rightValue]) => compare(left, right) || compare(leftValue, rightValue))
    .map(([name, value]) => `${name}=${value}`)
    .join('&');
}

function escape(text: string): string {
  return encodeURIComponent(text).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function compare(left: string, right: string): number {
  if (left === right) {
    return 0;
  }

  return left < right ? -1 : 1;
}

function signingKey(secret: string, date: string, region: string, service: string): Buffer {
  return [date, region, service, 'aws4_request'].reduce<Buffer>(
    (key, part) => hmac(key, part),
    Buffer.from(`AWS4${secret}`),
  );
}

function hmac(key: Buffer, data: string): Buffer {
  return createHmac('sha256', key).update(data).digest();
}

function sha256(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

function sameText(left: string, right: string): boolean {
  return left.length === right.length && timingSafeEqual(Buffer.from(left), Buffer.from(right));
}
