import type { Socket } from 'node:net';
import type { Connection, Wait } from './commands/command';
import { NONE } from './commands/connection';
import { CommandReader, encode } from './resp';
import { OK, type Reply, array, status } from './reply';

/** What a session asks of the server it belongs to. */
export interface Dispatcher {
  /** Runs a command; a read that must wait answers a `Wait`, unless `mayBlock` is false. */
  execute(command: readonly string[], connection: Connection, mayBlock: boolean): Reply | Wait;
  /** A refusal of the command before it runs (unknown, wrong arity), for `MULTI`. */
  refusalOf(command: readonly string[]): string | undefined;
  /** Resolves with the reply of the read once it has something, or with no reply at its timeout. */
  wait(wait: Wait, session: ClientSession): Promise<Reply>;
  /** Serves the reads waiting on the keys the last command changed. */
  wakeUp(): void;
  leave(session: ClientSession): void;
}

/**
 * One client connection: its commands run one after the other, in the order they came, a read
 * that waits holding back the ones after it as in Redis. `MULTI` queues the commands up to `EXEC`,
 * which runs them at once; one refused while queued discards the transaction.
 */
export class ClientSession implements Connection {
  protocol: 2 | 3 = 2;

  name: string | undefined;

  readonly channels = new Set<string>();

  private queued: (readonly string[])[] | undefined;

  private discarded = false;

  private chain: Promise<void> = Promise.resolve();

  private closed = false;

  constructor(
    readonly id: number,
    private readonly socket: Socket,
    private readonly server: Dispatcher,
  ) {
    const reader = new CommandReader((command) => {
      this.chain = this.chain.then(() => this.handle(command));
    });

    socket.on('data', (chunk: Buffer) => {
      reader.feed(chunk);
    });

    socket.on('close', () => {
      this.closed = true;
      server.leave(this);
    });

    socket.on('error', () => undefined);
  }

  get isClosed(): boolean {
    return this.closed;
  }

  push(reply: Reply): void {
    this.write(reply);
  }

  quit(): void {
    this.socket.end();
  }

  close(): void {
    this.socket.destroy();
  }

  private async handle(command: readonly string[]): Promise<void> {
    if (this.closed) {
      return;
    }

    const reply = await this.reply(command);

    this.write(reply);
    this.server.wakeUp();
  }

  private async reply(command: readonly string[]): Promise<Reply> {
    const name = command[0]?.toUpperCase();

    if (name === 'MULTI') {
      if (this.queued !== undefined) {
        return error('ERR MULTI calls can not be nested');
      }

      this.queued = [];
      this.discarded = false;

      return OK;
    }

    if (name === 'EXEC' || name === 'DISCARD') {
      return this.finish(name);
    }

    if (this.queued !== undefined) {
      const refusal = this.server.refusalOf(command);

      if (refusal !== undefined) {
        this.discarded = true;

        return error(refusal);
      }

      this.queued.push(command);

      return status('QUEUED');
    }

    const answer = this.server.execute(command, this, true);

    return answer.kind === 'wait' ? this.server.wait(answer, this) : answer;
  }

  private finish(name: 'EXEC' | 'DISCARD'): Reply {
    const queued = this.queued;

    this.queued = undefined;

    if (queued === undefined) {
      return error(`ERR ${name} without MULTI`);
    }

    if (name === 'DISCARD') {
      return OK;
    }

    if (this.discarded) {
      return error('EXECABORT Transaction discarded because of previous errors.');
    }

    return array(
      queued.map((command) => {
        const answer = this.server.execute(command, this, false);

        return answer.kind === 'wait' ? array(null) : answer;
      }),
    );
  }

  private write(reply: Reply): void {
    if (reply !== NONE && !this.closed) {
      this.socket.write(encode(reply, this.protocol));
    }
  }
}

function error(text: string): Reply {
  return { kind: 'error', text };
}
