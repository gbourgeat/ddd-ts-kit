import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { enclosingMember } from '../classes/enclosing-member.js';
import { keyName } from '../classes/key-name.js';
import type { MemberUse } from './member-use.js';

/** Remembers every `this.x`, `this.#x` and `ClassName.x` met during the traversal, per class. */
export class MemberUses {
  private readonly byClass = new Map<TSESTree.ClassBody, MemberUse[]>();

  record(node: TSESTree.MemberExpression): void {
    const name = node.computed ? undefined : keyName(node.property);
    const site = enclosingMember(node);

    if (name === undefined || site === undefined || !isOwnReceiver(node.object, site.body)) return;

    const uses = this.byClass.get(site.body) ?? [];

    uses.push({ name, owner: site.member, node });
    this.byClass.set(site.body, uses);
  }

  of(body: TSESTree.ClassBody): readonly MemberUse[] {
    return this.byClass.get(body) ?? [];
  }
}

function isOwnReceiver(receiver: TSESTree.Node, body: TSESTree.ClassBody): boolean {
  if (receiver.type === AST_NODE_TYPES.ThisExpression) return true;

  return receiver.type === AST_NODE_TYPES.Identifier && receiver.name === body.parent.id?.name;
}
