import { Clock } from '@ddd-ts-kit/kernel';
import { Adapter, type BindingAspect } from '@ddd-ts-kit/kernel/declarations';
import { Mailer } from '../../application/ports/mailer.port.js';
import { wrappedMailers } from './wrapped-mailers.js';

const noting: BindingAspect = (instance, info) => {
  wrappedMailers.push(`${info.className} as ${info.kind ?? 'nothing'} in ${info.context} for ${info.token}`);

  return instance;
};

@Adapter(Mailer, { kind: 'external', transient: true, aspects: [noting] }, [Clock])
export class OutboxMailer implements Mailer {
  static readonly sent: string[] = [];

  constructor(private readonly clock: Clock) {}

  async send(to: string, subject: string): Promise<void> {
    OutboxMailer.sent.push(`${to}: ${subject} (${this.clock.now().toISOString()})`);
  }
}
