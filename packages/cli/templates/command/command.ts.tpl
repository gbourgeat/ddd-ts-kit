import { Command } from '@ddd-ts-kit/kernel';

export class {{name.pascal}}Command extends Command<{{command.result}}> {
  // TODO(domain): declare the input of "{{name.words}}" as a constructor with readonly primitives and ids, for example `constructor(readonly customerId: string) { super(); }`; the handler turns them into value objects.
}
