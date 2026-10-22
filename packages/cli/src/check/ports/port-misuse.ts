import type { Flaw } from '../model/flaw';
import type { ClassShape } from '../structure/class-shape';

/** What is wrong with the way `adapter` stands for `port`: it has to implement it, and never extend it. */
export function portMisuse(adapter: ClassShape, port: string): Flaw | undefined {
  if (adapter.superclass === port) {
    return {
      message: `${adapter.name} extends its port ${port}: an adapter implements its port, it never extends it.`,
      fix: `Write \`class ${adapter.name} implements ${port}\`: a port is a contract with abstract members only, and the adapter that extends it is refused when it is bound.`,
    };
  }

  if (adapter.implemented.includes(port)) {
    return undefined;
  }

  return {
    message: `${adapter.name} is bound to ${port} without implementing it.`,
    fix: `Add \`implements ${port}\` to ${adapter.name}, so that the compiler holds the adapter to the contract it is bound to.`,
  };
}
