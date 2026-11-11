import type { Config } from '../config';
import type { RenderContext } from '../templating';
import { brokerVars } from './broker-vars';
import { redisVars } from './redis-vars';

const REDIS = 'REDIS_URL';

/**
 * The servers the spec files of an end-to-end run still share when the environment names them. The
 * database is not one of them, each file runs on a copy of it: a broker and a Redis protocol
 * server are, and the configuration of the runner keeps the files one after the other there.
 */
export function endToEndVars(config: Config): RenderContext {
  const address = brokerVars(config)['variable'];
  const redis = redisVars(config);
  const broker = typeof address === 'string' && address !== '' ? [address] : [];
  const variables = [...broker, ...(redis['server'] === true ? [REDIS] : [])];

  return {
    sharedServer: variables.length > 0,
    sharedVariables: variables.join(' or '),
    sharedBy: variables.length > 0 ? sharedBy(broker.length > 0, redis) : '',
    apartInVitest: variables.map((variable) => `(process.env['${variable}'] ?? '') === ''`).join(' && '),
    sharedInJest: variables.map((variable) => `(process.env.${variable} ?? '') !== ''`).join(' || '),
  };
}

/** Why the files cannot overlap on these servers, as the comment of the configuration says it. */
function sharedBy(broker: boolean, redis: RenderContext): string {
  const events = broker || redis['streams'] === true;
  const keys = redis['server'] === true;
  const servers = [...(broker ? ['a broker'] : []), ...(keys ? ['a Redis server'] : [])];
  const harms = [...(events ? ['consume the events'] : []), ...(keys ? ['read the keys'] : [])];
  const subject = servers.join(' and ');
  const verb = servers.length > 1 ? 'are' : 'is';

  return `${subject.charAt(0).toUpperCase()}${subject.slice(1)} ${verb} one for every file, which would ${harms.join(' and ')} of the others`;
}
