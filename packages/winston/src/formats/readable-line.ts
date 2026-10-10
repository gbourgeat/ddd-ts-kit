import { inspect } from 'node:util';
import winston from 'winston';

const TIME_OF_DAY = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  fractionalSecondDigits: 3,
});

/** One line for a human: the local time of day, the level in colour, the message, then the fields. */
export function readableLine(): winston.Logform.Format {
  return winston.format.combine(
    winston.format.colorize(),
    winston.format.printf(({ level, message, time, ...rest }) => {
      // By its string keys: winston keeps the level and the rendered line under symbols.
      const fields = Object.fromEntries(Object.entries(rest));
      const shown = Object.keys(fields).length === 0 ? '' : ` ${inspect(fields, { depth: 6, breakLength: 120 })}`;

      return `${TIME_OF_DAY.format(new Date(String(time)))} ${level} ${String(message)}${shown}`;
    }),
  );
}
