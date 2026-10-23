import type { Stock } from './stock.port';

export class InMemoryStock implements Stock {
  private readonly skus: string[] = [];

  async reserve(sku: string): Promise<void> {
    this.skus.push(sku);
  }

  reserved(): readonly string[] {
    return this.skus;
  }
}
