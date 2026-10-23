import { CommandError, OK, type Reply, array, bulk, integer, map, status } from '../reply';
import { type Commands, upper } from './command';

/** The server as Dragonfly announces itself, so that a client sees the version it checks for. */
const VERSION = '7.4.0';

/** HELLO, AUTH, CLIENT, SELECT, INFO, PING, ECHO, QUIT, and the channels of SUBSCRIBE and PUBLISH. */
export const CONNECTION_COMMANDS: Commands = {
  HELLO: {
    arity: -1,
    run: ([version, ...options], { connection }) => {
      if (version !== undefined) {
        const protocol = integerOrRefusal(version);

        if (protocol !== 2 && protocol !== 3) {
          throw new CommandError('NOPROTO unsupported protocol version');
        }

        connection.protocol = protocol;
      }

      for (let index = 0; index < options.length; index += 1) {
        const option = upper(options[index]);

        if (option === 'AUTH') {
          refuseAuthentication();
        } else if (option === 'SETNAME') {
          index += 1;
          connection.name = options[index];
        } else {
          throw CommandError.syntax();
        }
      }

      return map([
        ['server', bulk('redis')],
        ['version', bulk(VERSION)],
        ['proto', integer(connection.protocol)],
        ['id', integer(connection.id)],
        ['mode', bulk('standalone')],
        ['role', bulk('master')],
        ['modules', array([])],
      ]);
    },
  },

  AUTH: {
    arity: -2,
    run: () => refuseAuthentication(),
  },

  CLIENT: {
    arity: -2,
    run: ([subcommand, ...rest], { connection }) => {
      switch (upper(subcommand)) {
        case 'SETNAME':
          connection.name = rest[0];

          return OK;
        case 'GETNAME':
          return bulk(connection.name ?? null);
        case 'ID':
          return integer(connection.id);
        case 'SETINFO':
          return OK;
        default:
          throw new CommandError(`ERR unknown subcommand '${subcommand ?? ''}'.`);
      }
    },
  },

  SELECT: {
    arity: 2,
    run: ([index]) => {
      if (index !== '0') {
        throw new CommandError('ERR DB index is out of range');
      }

      return OK;
    },
  },

  INFO: {
    arity: -1,
    run: () => ({
      kind: 'text',
      value: `# Server\r\nredis_version:${VERSION}\r\nredis_mode:standalone\r\n\r\n# Persistence\r\nloading:0\r\n`,
    }),
  },

  PING: {
    arity: -1,
    run: ([message], { connection }) => {
      if (connection.channels.size > 0 && connection.protocol === 2) {
        return array([bulk('pong'), bulk(message ?? '')]);
      }

      return message === undefined ? status('PONG') : bulk(message);
    },
  },

  ECHO: {
    arity: 2,
    run: ([message = '']) => bulk(message),
  },

  QUIT: {
    arity: 1,
    run: (_, { connection }) => {
      connection.quit();

      return OK;
    },
  },

  SUBSCRIBE: {
    arity: -2,
    run: (channels, { connection }) => {
      for (const channel of channels) {
        connection.channels.add(channel);
        connection.push(subscription('subscribe', channel, connection.channels.size));
      }

      return NONE;
    },
  },

  UNSUBSCRIBE: {
    arity: -1,
    run: (channels, { connection }) => {
      const leaving = channels.length === 0 ? [...connection.channels] : channels;

      for (const channel of leaving) {
        connection.channels.delete(channel);
        connection.push(subscription('unsubscribe', channel, connection.channels.size));
      }

      return NONE;
    },
  },

  PUBLISH: {
    arity: 3,
    run: ([channel = '', message = ''], { publish }) => integer(publish(channel, message)),
  },
};

/** What a command that answers by pushes alone replies: nothing more. */
export const NONE: Reply = { kind: 'push', items: [] };

function subscription(kind: string, channel: string, count: number): Reply {
  return { kind: 'push', items: [bulk(kind), bulk(channel), integer(count)] };
}

/** The server has no password, as the servers of the specs: a client that sends one is refused. */
function refuseAuthentication(): never {
  throw new CommandError(
    'ERR AUTH <password> called without any password configured for the default user. Are you sure your configuration is correct?',
  );
}

function integerOrRefusal(text: string): number {
  if (!/^\d+$/.test(text)) {
    throw new CommandError('ERR Protocol version is not an integer or out of range');
  }

  return Number(text);
}
