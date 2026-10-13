/** An amount of money in a body: the decimal as text, with the ISO 4217 code of its currency. */
export interface MoneyBody {
  readonly amount: string;
  readonly currency: string;
}
