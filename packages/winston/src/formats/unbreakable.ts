import { UNWRITABLE_FIELDS } from '@ddd-ts-kit/kernel';
import winston from 'winston';
import { isoTime } from './iso-time.js';

/** The key under which winston and its transports read the level of a line (package `triple-beam`). */
const LEVEL = Symbol.for('level');

/**
 * The format, and when it throws on a line (a getter that throws, a `toJSON` that fails), that
 * line as JSON without its fields. winston formats a line inside its stream: an exception
 * there reaches the caller, or the process when the stream was holding the line back.
 */
export function unbreakable(format: winston.Logform.Format): winston.Logform.Format {
  const bare = winston.format.combine(isoTime(), winston.format.json());

  return {
    transform: (info, options) => {
      try {
        return format.transform(info, options);
      } catch {
        return bare.transform({ level: info.level, message: info.message, ...UNWRITABLE_FIELDS, [LEVEL]: info[LEVEL] });
      }
    },
  };
}
