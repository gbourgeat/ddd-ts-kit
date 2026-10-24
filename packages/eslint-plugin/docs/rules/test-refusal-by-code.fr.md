[English](test-refusal-by-code.md) · **Français**
<!-- translation-of: test-refusal-by-code.md sha256:d0f4cd2f5172b6e2 -->

# ddd-ts-kit/test-refusal-by-code

Identifiant d'architecture : `test/refusal-by-code` (ajouté par ce *plugin*). Sévérité par défaut : `warn` dans `recommended` (une erreur à partir de 0.90.0 : `ddd-ts-kit lint` montre ses avertissements sans échouer dessus jusque-là), `error` dans `strict`.

S'applique à : les *specs* du modèle et de l'application, `test/unit/` d'un contexte, le noyau partagé, `test/e2e/` et `test/acceptance/` (`*.spec.ts`, `*.test.ts`). Les *specs* des adaptateurs (`*.adapter.spec.ts`, `test/integration/`) et de la plateforme ne sont pas jugées.

## Pourquoi

Un refus du modèle porte un code et ses faits (`INVOICE_ALREADY_PAID`, `{ invoiceId }`) : le client les reçoit dans le document de problème, le catalogue du contexte les liste, le lecteur du test apprend quelle règle a refusé. Un message est de la prose qu'une reformulation change sans changer la règle ; la classe d'une erreur est une implémentation que les fabriques de `domain/errors/` peuvent fondre dans une autre. Un `toThrow()` sans argument accepte n'importe quel échec, un `TypeError` du test compris.

## Signalé

`toThrow` et `toThrowError`, après `expect(action)` ou `expect(promise).rejects`, quand leur argument est :

- rien
- une chaîne, un gabarit ou une expression régulière (un message)
- une classe, une variable ou `new Error(...)`

Incorrect :

```ts
expect(() => invoice.pay(at)).toThrow('already paid');
expect(() => invoice.pay(at)).toThrow(InvoiceAlreadyPaid);
expect(() => Email.create('  ')).toThrow();
await expect(bus.execute(command)).rejects.toThrowError(/forbidden/);
```

Correct :

```ts
given(anInvoice().paid())
  .when((invoice) => invoice.pay(at))
  .thenError('INVOICE_ALREADY_PAID', { invoiceId: 'invoice-1' });

expectRefusal(() => Email.create('  '), 'INVALID_EMAIL', { given: '  ' });

await expect(bus.execute(command)).rejects.toMatchObject({ code: 'FORBIDDEN' });

expectProblem(response, { status: 409, code: 'SLOT_TAKEN' });
```

## Détails

`expect(action).not.toThrow()` dit qu'une action est acceptée et n'est pas signalé. `toThrow(expect.objectContaining({ code: 'INVOICE_ALREADY_PAID' }))` et `toThrow({ code: ... })` vérifient le code et ne sont pas signalés non plus, même si `thenError` et `expectRefusal` le disent plus court et comparent les faits.

Un échec que le test a lui-même injecté (`mailer.failNextWith(outage)`, un *middleware* qui lève) se vérifie comme lui-même, `await expect(bus.execute(command)).rejects.toBe(outage)` : c'est la preuve que cet échec, et pas un autre de même message, est remonté.

Un adaptateur, les *specs* d'intégration d'un contexte et la plateforme font face au système extérieur et à la machine : leurs échecs sont techniques (`KEYCLOAK_URL is not set`, `Keycloak answered 403`), leur message est ce qu'un opérateur lit, et c'est ce que leurs *specs* vérifient. Ils ne sont pas jugés.

## Options

Aucune.

`rules."test/refusal-by-code"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line test/refusal-by-code -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- Un *matcher* du projet qui compare un message (`expectFailure(action, 'message')`) n'est pas lu.

## Avec le checker de la CLI

Nouveau avec ce *plugin* : le *checker* de la CLI n'a pas d'équivalent, car lire un test demande un arbre syntaxique.
