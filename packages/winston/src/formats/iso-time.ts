import winston from 'winston';

/** Stamps the line with `time` in ISO 8601, over a field of that name. */
export function isoTime(): winston.Logform.Format {
  return winston.format((info) => {
    info.time = new Date().toISOString();

    return info;
  })();
}
