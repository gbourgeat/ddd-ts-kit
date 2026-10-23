import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { methodChain } from '../calls/method-chain';

interface RegisteredJob {
  /** The `job(name, ..)` call of the statement. */
  readonly registration: TSESTree.CallExpression;
  /** The class given to `handledBy`, when it is named. */
  readonly handler: TSESTree.Identifier | undefined;
}

/** `builder.job('billing.send-reminders', { every: '15m' }).handledBy(SendRemindersJob, [..])`, read from its last call. */
export function registeredJob(node: TSESTree.CallExpression): RegisteredJob | undefined {
  const chain = methodChain(node);
  const registration = chain.find((link) => link.name === 'job')?.call;
  const last = chain.at(-1);
  const [handler] = last?.call.arguments ?? [];

  if (registration === undefined || last === undefined || !last.name.startsWith('handledBy')) {
    return undefined;
  }

  return {
    registration,
    handler: last.name === 'handledBy' && handler?.type === AST_NODE_TYPES.Identifier ? handler : undefined,
  };
}
