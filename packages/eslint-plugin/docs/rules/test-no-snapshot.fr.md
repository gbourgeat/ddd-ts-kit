[English](test-no-snapshot.md) · **Français**
<!-- translation-of: test-no-snapshot.md sha256:40cd387b2b3fb2ba -->

# ddd-ts-kit/test-no-snapshot

Identifiant d'architecture : `test/no-snapshot` (ajouté par ce *plugin*). Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : chaque fichier de test du projet (`*.spec.ts`, `*.test.ts`, le `test/` d'un contexte).

## Pourquoi

Un *snapshot* enregistre ce que le code a produit la première fois, et se renouvelle d'un seul drapeau la fois suivante où il diffère : il ne vérifie rien qu'un lecteur puisse confronter à la règle, et il échoue sur chaque champ dont la règle ne dépend pas. Un test énonce les champs qui comptent, construits dans le test, pour que le lecteur voie la cause du résultat.

## Signalé

- `toMatchSnapshot`, `toMatchInlineSnapshot`, `toMatchFileSnapshot`
- `toThrowErrorMatchingSnapshot`, `toThrowErrorMatchingInlineSnapshot`

Incorrect :

```ts
expect(invoice.toState()).toMatchSnapshot();
expect(() => invoice.pay(at)).toThrowErrorMatchingInlineSnapshot();
```

Correct :

```ts
expect(invoice.toState()).toMatchObject({ status: 'paid', paidAt: at });

given(anInvoice().paid())
  .when((invoice) => invoice.pay(at))
  .thenError('INVOICE_ALREADY_PAID');
```

## Détails

Les contrats que le kit génère (OpenAPI, AsyncAPI, le catalogue d'événements) sont tenus par `ddd-ts-kit docs --check`, qui compare le document généré avec celui qui est *commité* : c'est le seul endroit où un document entier est comparé, et ce n'est pas un test.

## Options

Aucune.

`rules."test/no-snapshot"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line test/no-snapshot -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- Un `toEqual` sur un gros objet lu dans un fichier de *fixture* est un *snapshot* sous un autre nom, et n'est pas signalé.

## Avec le checker de la CLI

Nouveau avec ce *plugin* : le *checker* de la CLI n'a pas d'équivalent, car lire un test demande un arbre syntaxique.
