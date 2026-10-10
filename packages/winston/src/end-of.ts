import type winston from 'winston';

type Transport = winston.Logger['transports'][number];

/** Ends the logger and resolves once each of its transports has written what it was handed. */
export async function endOf(logger: winston.Logger): Promise<void> {
  const finished = logger.transports.map(finishOf);

  logger.end();
  await Promise.all(finished);
}

function finishOf(transport: Transport): Promise<void> {
  return new Promise((resolve) => {
    transport.once('finish', resolve);

    transport.once('error', () => {
      resolve();
    });
  });
}
