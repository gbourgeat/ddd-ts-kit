/** Who calls whom among the declarations of one class or one module, to recognise recursion. */
export class CallGraph<Declaration> {
  private readonly callees = new Map<Declaration, Set<Declaration>>();

  add(caller: Declaration, callee: Declaration): void {
    const callees = this.callees.get(caller) ?? new Set<Declaration>();

    callees.add(callee);
    this.callees.set(caller, callees);
  }

  /** True when `from` calls `to`, directly or through other declarations. */
  reaches(from: Declaration, to: Declaration): boolean {
    const seen = new Set<Declaration>();
    const pending = [from];

    for (let current = pending.pop(); current !== undefined; current = pending.pop()) {
      for (const callee of this.callees.get(current) ?? []) {
        if (callee === to) return true;
        if (!seen.has(callee)) pending.push(callee);

        seen.add(callee);
      }
    }

    return false;
  }
}
