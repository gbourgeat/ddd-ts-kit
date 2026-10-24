[English](test-assertion-present.md) · **Français**
<!-- translation-of: test-assertion-present.md sha256:1047d2cf38c27c16 -->

# ddd-ts-kit/test-assertion-present

Identifiant d'architecture : `test/assertion-present` (ajouté par ce *plugin*). Sévérité par défaut : `warn` dans `recommended` (une erreur à partir de 0.90.0 : `ddd-ts-kit lint` montre ses avertissements sans échouer dessus jusque-là), `error` dans `strict`.

S'applique à : chaque fichier de test du projet (`*.spec.ts`, `*.test.ts`, le `test/` d'un contexte).

## Pourquoi

Un test qui ne vérifie rien passe quoi que fasse le code, et fait monter le taux de couverture sans rien prouver : c'est le trou que `test/coverage-governed` ne peut pas voir. Le kit vérifie des résultats : l'état d'un *fake*, les faits enregistrés, le refus par son code, la réponse d'une route.

## Signalé

- un `it` ou un `test` dont le corps ne contient aucun appel à `expect`, à une fonction nommée `expect...` ou `assert...` (`expectRefusal`, `expectProblem`, `expectStatus`, `expectSpanTree`, un *helper* du projet), ni au résultat d'un scénario de `@ddd-ts-kit/testing` (`thenEvents`, `thenEventNames`, `thenError`, `thenState`, `thenNoEvent`)
- un `it` ou un `test` avec un titre et sans corps, que Vitest compte comme un *todo* et que Jest refuse

Incorrect :

```ts
it('issues the invoice', async () => {
  await application.commandBus.execute(new IssueInvoiceCommand(holder, 'customer-1'));
});

it('refuses a second payment');
```

Correct :

```ts
it('issues the invoice and answers its identifier', async () => {
  const id = await application.commandBus.execute(new IssueInvoiceCommand(holder, 'customer-1'));

  expect(await invoiceRepository.findById(id)).toBeDefined();
});

it.todo('refuses a second payment');
```

## Détails

Le corps est lu en entier, scénario enveloppé par `pending(...)` compris, de sorte qu'un scénario d'acceptation qui attend son code est jugé comme les autres. Un *helper* qui vérifie pour plusieurs tests se nomme `expect...` ou `assert...` : la règle le voit alors, et le lecteur aussi.

## Options

Aucune.

`rules."test/assertion-present"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line test/assertion-present -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- La règle voit qu'une vérification est faite, pas qu'elle porte sur le résultat : `expect(true).toBe(true)` passe. La revue lit ce qui est vérifié.
- Un `.then(...)` sur une promesse n'est pas le résultat d'un scénario.

## Avec le checker de la CLI

Nouveau avec ce *plugin* : le *checker* de la CLI n'a pas d'équivalent, car lire un test demande un arbre syntaxique.
