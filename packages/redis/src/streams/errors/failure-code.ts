const IDENTIFIER = /^[A-Za-z][A-Za-z0-9_.:-]{0,63}$/;

/** The protocol starts an error reply with its kind in capitals: only that word is kept. */
const REPLY_KIND = /^[A-Z][A-Z0-9]{1,31}(?= |$)/;

/**
 * What may be reported about a caught error: its `code` when it carries one (`ECONNREFUSED`),
 * the kind of an error answered by the server (`REDIS_NOGROUP`, `REDIS_OOM`), else its class
 * name. Never the message, which may quote a key, a URL or payload data.
 */
export function failureCode(error: unknown): string {
  if (typeof error !== 'object' || error === null) {
    return 'UNKNOWN_ERROR';
  }

  if ('code' in error && typeof error.code === 'string' && IDENTIFIER.test(error.code)) {
    return error.code;
  }

  if (!(error instanceof Error)) {
    return 'UNKNOWN_ERROR';
  }

  if (error.name === 'ReplyError') {
    return replyKind(error.message);
  }

  return IDENTIFIER.test(error.constructor.name) ? error.constructor.name : 'UNKNOWN_ERROR';
}

function replyKind(reply: string): string {
  const kind = REPLY_KIND.exec(reply)?.[0];

  return kind === undefined ? 'REDIS_ERROR' : `REDIS_${kind}`;
}
