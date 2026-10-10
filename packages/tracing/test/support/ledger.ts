/** A dependency written the way the kit asks: `private` fields and methods reached through `this`. */
export class Ledger {
  private readonly balances = new Map<string, number>([['acc-1', 100]]);

  private readonly reads: string[] = [];

  get readCount(): number {
    return this.reads.length;
  }

  async balanceOf(id: string): Promise<number> {
    this.reads.push(id);

    return this.postedOf(id) + (await this.pendingOf(id));
  }

  private postedOf(id: string): number {
    return this.balances.get(id) ?? 0;
  }

  private async pendingOf(id: string): Promise<number> {
    return this.balances.has(id) ? 5 : 0;
  }
}
