import { Command } from '../../../../../../../../src/index.js';
import { Public } from '../../../../../../../../src/declarations.js';

@Public({ audited: ['reason'] })
export class RequestCallback extends Command {
  constructor(readonly reason: string) {
    super();
  }
}
