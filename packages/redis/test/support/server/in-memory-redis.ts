import { type Server, type Socket, createServer } from 'node:net';
import { ClientSession, type Dispatcher } from './client-session';
import { type Command, type Commands, type Connection, type Context, type Wait, upper } from './commands/command';
import { CONNECTION_COMMANDS } from './commands/connection';
import { KEY_COMMANDS } from './commands/keys';
import { SORTED_SET_COMMANDS } from './commands/sorted-sets';
import { GROUP_COMMANDS } from './commands/stream-groups';
import { STREAM_COMMANDS } from './commands/streams';
import { HASH_COMMANDS, STRING_COMMANDS } from './commands/strings-and-hashes';
import { Keyspace } from './keyspace';
import { LuaScripts } from './lua-scripts';
import { CommandError, type Reply, array, bulk } from './reply';

interface Waiting {
  readonly wait: Wait;
  readonly session: ClientSession;
  resolve(reply: Reply): void;
  readonly timer: NodeJS.Timeout | undefined;
}

/**
 * A Redis server in the process of the test, on a port of its own, so that the specs of the
 * adapters run in the unit run too, through the real ioredis client and its real TCP transport.
 * It speaks RESP2 and RESP3 and keeps what the adapters and their specs ask, answered as Dragonfly
 * answers, from a recording of the suites against it: strings with their expiries, hashes, sorted
 * sets, streams with their consumer groups and blocking reads, `MULTI`/`EXEC`, channels, and the
 * scripts of `EVAL` on the Lua 5.1 Redis embeds. One database, no password. Not kept: lists, sets,
 * keyspace notifications, `WATCH`, `EVALSHA`, functions, persistence, replication, cluster.
 */
export class InMemoryRedis implements Dispatcher {
  private readonly keyspace = new Keyspace(() => Date.now());

  private readonly sessions = new Set<ClientSession>();

  private readonly waiting = new Set<Waiting>();

  private readonly changedKeys = new Set<string>();

  private readonly commands: Commands;

  private ids = 0;

  private constructor(
    private readonly server: Server,
    private readonly scripts: LuaScripts,
  ) {
    this.commands = {
      ...CONNECTION_COMMANDS,
      ...KEY_COMMANDS,
      ...STRING_COMMANDS,
      ...HASH_COMMANDS,
      ...SORTED_SET_COMMANDS,
      ...STREAM_COMMANDS,
      ...GROUP_COMMANDS,
      EVAL: { arity: -3, run: (args, context) => scripts.eval(args, context) },
    };

    server.on('connection', (socket: Socket) => {
      this.ids += 1;
      this.sessions.add(new ClientSession(this.ids, socket, this));
    });
  }

  static async start(): Promise<InMemoryRedis> {
    const scripts = await LuaScripts.create();
    const server = createServer();

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });

    return new InMemoryRedis(server, scripts);
  }

  get url(): string {
    const address = this.server.address();

    return `redis://127.0.0.1:${String(typeof address === 'object' && address !== null ? address.port : 0)}`;
  }

  async stop(): Promise<void> {
    for (const session of this.sessions) {
      session.close();
    }

    await new Promise<void>((resolve) => {
      this.server.close(() => {
        resolve();
      });
    });

    this.scripts.close();
  }

  execute(command: readonly string[], connection: Connection, mayBlock: boolean): Reply | Wait {
    const [name = '', ...args] = command;
    const refusal = this.refusalOf(command);

    if (refusal !== undefined) {
      return { kind: 'error', text: refusal };
    }

    try {
      return this.commandOf(name)?.run(args, this.contextOf(connection, mayBlock)) ?? { kind: 'error', text: 'ERR' };
    } catch (error) {
      return { kind: 'error', text: error instanceof CommandError ? error.message : `ERR ${String(error)}` };
    }
  }

  refusalOf(command: readonly string[]): string | undefined {
    const [name = '', ...args] = command;
    const known = this.commandOf(name);

    if (known === undefined) {
      const beginning = args
        .slice(0, 3)
        .map((arg) => `'${arg}'`)
        .join(' ');

      return `ERR unknown command '${name}', with args beginning with: ${beginning}`;
    }

    const count = command.length;

    return (known.arity > 0 ? count === known.arity : count >= -known.arity)
      ? undefined
      : CommandError.arity(name).message;
  }

  wait(wait: Wait, session: ClientSession): Promise<Reply> {
    return new Promise((resolve) => {
      const timer =
        wait.timeoutMs === 0
          ? undefined
          : setTimeout(() => {
              this.waiting.delete(waiting);
              resolve(array(null));
            }, wait.timeoutMs);

      const waiting: Waiting = { wait, session, resolve, timer };

      this.waiting.add(waiting);
    });
  }

  wakeUp(): void {
    const keys = [...this.changedKeys];

    this.changedKeys.clear();

    for (const waiting of this.waiting) {
      if (!waiting.wait.keys.some((key) => keys.includes(key))) {
        continue;
      }

      const reply = this.retry(waiting.wait);

      if (reply !== undefined) {
        this.settle(waiting, reply);
      }
    }
  }

  leave(session: ClientSession): void {
    this.sessions.delete(session);

    for (const waiting of this.waiting) {
      if (waiting.session === session) {
        this.settle(waiting, array(null));
      }
    }
  }

  private retry(wait: Wait): Reply | undefined {
    try {
      return wait.retry();
    } catch (error) {
      return { kind: 'error', text: error instanceof CommandError ? error.message : `ERR ${String(error)}` };
    }
  }

  private settle(waiting: Waiting, reply: Reply): void {
    clearTimeout(waiting.timer);
    this.waiting.delete(waiting);
    waiting.resolve(reply);
  }

  private commandOf(name: string): Command | undefined {
    return Object.hasOwn(this.commands, upper(name)) ? this.commands[upper(name)] : undefined;
  }

  private contextOf(connection: Connection, mayBlock: boolean): Context {
    return {
      keyspace: this.keyspace,
      now: () => Date.now(),
      mayBlock,
      connection,
      changed: (key) => {
        this.changedKeys.add(key);
      },
      publish: (channel, message) => this.publish(channel, message),
      run: (command) => {
        const answer = this.execute(command, connection, false);

        return answer.kind === 'wait' ? array(null) : answer;
      },
    };
  }

  private publish(channel: string, message: string): number {
    const receivers = [...this.sessions].filter((session) => session.channels.has(channel));

    for (const session of receivers) {
      session.push({ kind: 'push', items: [bulk('message'), bulk(channel), bulk(message)] });
    }

    return receivers.length;
  }
}
