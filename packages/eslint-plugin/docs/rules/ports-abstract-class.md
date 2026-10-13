**English** · [Français](ports-abstract-class.fr.md)

# ddd-ts-kit/ports-abstract-class

Architecture id: `ports/abstract-class`. Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: port files of a context: `domain/repositories/*.repository.ts` and `application/ports/*.port.ts`.

## Why

A port is an abstract class with abstract members only. The class is the contract and the injection token at once: it names the dependency in a dependency list, carries its type to the constructor, and there is no constant and no token file to keep in step with it. A port that holds a body, a field or a constructor is a base class in disguise: adapters start to inherit behaviour, and a fake no longer fits.

## Reported

- a class that is not `abstract`
- a constructor
- a `private`, `protected` or `#` member
- a method with a body, a property with an initializer, a member that is not `abstract`
- an exported `interface`: a port is declared as an abstract class

Incorrect:

```ts
// application/ports/payment-gateway.port.ts
export interface PaymentGateway {
  charge(invoiceId: string): Promise<void>;
}

// domain/repositories/invoice.repository.ts
export abstract class InvoiceRepository {
  constructor(protected readonly table: string) {}

  async exists(id: string): Promise<boolean> {
    return (await this.findById(id)) !== undefined;
  }
}
```

Correct:

```ts
// application/ports/payment-gateway.port.ts
export abstract class PaymentGateway {
  abstract charge(invoiceId: string): Promise<void>;
}

// domain/repositories/invoice.repository.ts
import { Repository } from '@ddd-ts-kit/kernel';

export abstract class InvoiceRepository extends Repository<Invoice> {}
```

## Details

A port may extend another one: the kernel `Repository<A>`, or a port of the same context. One member is allowed besides the abstract ones: `static readonly tokenKey = '<package>.<Port>'`, a string literal that gives the port one identity when its package is loaded twice. A value that is not a port (settings, a database handle) is typed the same way, by an abstract class with `abstract readonly` properties.

An exported `type` alias is not reported: the shape of the data that travels through the port may be a type. An interface that is not exported is left alone too.

## Options

None.

`rules."ports/abstract-class"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line ports/abstract-class -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- A member inherited from a class of another file is not read: `@Repository`, `@Gateway` and `@Adapter` refuse a port with a body when the file loads.
- A port declared outside the two port folders is not judged.

## With the CLI checker

`ddd-ts-kit check` reports the same id from the text of the files. This rule is the authority for the code.
