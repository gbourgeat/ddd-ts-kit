[English](test-no-logic.md) · **Français**
<!-- translation-of: test-no-logic.md sha256:32c6e7bc125f7cc7 -->

# ddd-ts-kit/test-no-logic

Identifiant d'architecture : `test/no-logic` (ajouté par ce *plugin*). Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : chaque fichier de test du projet (`*.spec.ts`, `*.test.ts`, le `test/` d'un contexte).

## Pourquoi

Un test se lit sans être exécuté : il prépare un état, agit une fois, vérifie ce qui est vrai ensuite, et échoue pour une seule raison. Un `if` dans un test est un second test caché dans le premier, ou un chemin que le test prend sans dire lequel ; une boucle vérifie plusieurs cas sous un seul titre, et le rapport n'en nomme aucun ; un `try` attrape ce que le lanceur aurait signalé avec sa pile. La logique qu'un test semble demander appartient à ce qu'il utilise : un *builder* décide comment se construit une facture payée, un *fake* décide quand le *mailer* échoue, un *helper* décide ce que contient une page.

## Signalé

Dans le corps d'un `it` ou d'un `test`, scénario enveloppé par `pending(...)` compris :

- `if`, `switch`, un ternaire
- `for`, `for ... of`, `for ... in`, `while`, `do`
- `try`

Incorrect :

```ts
it('accepts every kind', () => {
  for (const kind of kinds) {
    expect(NotificationKind.create(kind).value).toBe(kind);
  }
});

it('refuses a second payment', () => {
  try {
    invoice.pay(at);
  } catch (error) {
    expect(error).toMatchObject({ code: 'INVOICE_ALREADY_PAID' });
  }
});
```

Correct :

```ts
it.each(kinds)('accepts the kind %s', (kind) => {
  expect(NotificationKind.create(kind).value).toBe(kind);
});

it('refuses a second payment', () => {
  given(anInvoice().paid())
    .when((invoice) => invoice.pay(at))
    .thenError('INVOICE_ALREADY_PAID');
});
```

## Détails

Les *hooks* (`beforeEach`, `beforeAll`) et les fonctions déclarées à côté des tests ne sont pas jugés : une boucle qui alimente une table dans un *hook*, un *helper* de `test/e2e/support/` qui décide, sont la place de la logique. Un cas par ligne est un `it.each` dont la table est les lignes : le rapport nomme alors chacune.

## Options

Aucune.

`rules."test/no-logic"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line test/no-logic -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- `&&`, `||` et `??` ne sont pas signalés : `expect(a && b)` est une vérification faible, pas une branche.
- Une fonction appelée depuis le test et déclarée ailleurs peut contenir n'importe quelle logique : la règle lit le corps du test, la revue lit le *helper*.

## Avec le checker de la CLI

Nouveau avec ce *plugin* : le *checker* de la CLI n'a pas d'équivalent, car lire un test demande un arbre syntaxique.
