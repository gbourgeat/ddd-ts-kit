/** The fake of a mailer port: remembers what it was asked to send. */
export class Outbox {
  readonly sent: string[] = [];

  async send(to: string, subject: string): Promise<void> {
    this.sent.push(`${to}: ${subject}`);
  }
}
