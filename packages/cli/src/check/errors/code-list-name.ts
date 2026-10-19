import { toName } from '../../naming/index.js';

/** The name of the code list of a context: `SchedulingCodes` for `scheduling`, `OrderTakingCodes` for `order-taking`. */
export function codeListName(context: string): string {
  return `${toName(context).pascal}Codes`;
}
