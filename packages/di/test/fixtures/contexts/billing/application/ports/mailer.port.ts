export abstract class Mailer {
  abstract send(to: string, subject: string): Promise<void>;
}
