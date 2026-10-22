import { Command } from '../../../../../../../../src';
import { Public } from '../../../../../../../../src/declarations';

@Public({ audited: ['reason'] })
export class RequestCallback extends Command {
  constructor(readonly reason: string) {
    super();
  }
}
