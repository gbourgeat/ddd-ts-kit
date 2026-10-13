import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';

const REPOSITORY = /^([a-z][\w$]*)Repository$/;

/** `appointment` for `this.appointmentRepository` or `appointmentRepository`: a repository named by the convention of the kit. */
export function repositoryConcept(object: TSESTree.Expression): string | undefined {
  const holder =
    object.type === AST_NODE_TYPES.MemberExpression && object.object.type === AST_NODE_TYPES.ThisExpression
      ? object.property
      : object;

  return holder.type === AST_NODE_TYPES.Identifier ? REPOSITORY.exec(holder.name)?.[1] : undefined;
}
