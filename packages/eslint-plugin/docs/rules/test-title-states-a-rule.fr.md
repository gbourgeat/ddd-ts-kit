[English](test-title-states-a-rule.md) · **Français**
<!-- translation-of: test-title-states-a-rule.md sha256:9de5d77beee52337 -->

# ddd-ts-kit/test-title-states-a-rule

Identifiant d'architecture : `test/title-states-a-rule` (ajouté par ce *plugin*). Sévérité par défaut : `warn` dans `recommended` (une erreur à partir de 0.90.0 : `ddd-ts-kit lint` montre ses avertissements sans échouer dessus jusque-là), `error` dans `strict`.

S'applique à : chaque fichier de test du projet (`*.spec.ts`, `*.test.ts`, le `test/` d'un contexte).

## Pourquoi

Les titres d'une *spec* en sont la seule partie que toute l'équipe lit : le rapport d'une exécution en échec, la liste qu'imprime `npm test`, la revue. Écrits comme des règles, dans les mots du métier, ils sont la spécification de l'unité, et un nouveau test s'écrit en énonçant une règle de plus. Écrits `should ...`, `test ...` ou d'après une méthode, ils disent que quelque chose est testé sans dire ce qui est vrai, et le lecteur ouvre le corps pour le savoir.

## Signalé

Sur un `it` ou un `test`, après les *rows* et le critère que le titre cite (`#US5.02 AC1 ...`, `AC1 ...`, `#FIX-412 ...`) :

- un mot qui dit que le test est un test : `should`, `test`, `tests`, `testing`, `works`, `correctly`, `properly`, `successfully`, `as expected`, `make sure`, `ensures that`, `verifies that`, `checks that`
- un nom de code : un appel (`execute()`, `pay(at)`), un premier mot en camelCase (`issueInvoice`)
- un premier mot qui ne commence pas par une minuscule (`Refuses`, `The invoice`), sauf s'il est le paramètre d'un titre piloté par une table (`%s`, `$kind`)
- un titre vide

Sur un `describe` : un titre nommé d'après les tests (`tests`, `spec`, `suite`, `should`, un suffixe `Spec` ou `Test`) ou vide.

Incorrect :

```ts
describe('Invoice tests', () => {
  it('should refuse a second payment', () => { ... });
  it('execute() saves the invoice', () => { ... });
  it('Pays the invoice correctly', () => { ... });
});
```

Correct :

```ts
describe('Invoice', () => {
  it('refuses to pay an invoice twice', () => { ... });
  it('saves the invoice and answers its identifier', () => { ... });
  it('#US5.02 AC1 a customer places an order', pending(async () => { ... }));
  it.each(kinds)('%s announces an appointment to come', (kind) => { ... });
});
```

## Détails

Un titre tenu dans une variable n'est pas jugé. Un titre en gabarit est lu avec ses expressions comme paramètres : `` `answers ${status} to a caller` `` passe, et de même un titre qui commence par une expression. `describe` prend l'unité sous test, l'agrégat (`Invoice`), le cas d'usage (`Issue invoice`), la route (`POST /invoices`), un fait (`When scheduling publishes scheduling.appointment.booked`) : un nom, dans la casse qu'il a.

## Options

Aucune.

`rules."test/title-states-a-rule"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line test/title-states-a-rule -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- La règle lit la forme d'un titre, pas son sens : `records the payment` passe, que le test enregistre un paiement ou non. La revue lit le corps.
- Un verbe est reconnu à sa casse, pas à un dictionnaire : `the invoice is paid` passe.

## Avec le checker de la CLI

Nouveau avec ce *plugin* : le *checker* de la CLI n'a pas d'équivalent, car lire un test demande un arbre syntaxique.
