[English](domain-no-generic-error.md) · **Français**
<!-- translation-of: domain-no-generic-error.md sha256:1c1fcea456ade425 -->

# ddd-ts-kit/domain-no-generic-error

Identifiant d'architecture : `domain/no-generic-error` (ajouté par ce *plugin*). Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : `domain/` et `application/` d'un contexte, tests exclus.

## Pourquoi

Un échec métier attendu a un nom et un code stable que la présentation fait correspondre à un statut, en un seul endroit. `new Error("...")` donne à l'appelant une phrase à analyser.

## Signalé

- `throw new Error(...)` et `throw Error(...)`
- les autres erreurs du langage : `TypeError`, `RangeError`, `ReferenceError`, `SyntaxError`, `EvalError`, `URIError`, `AggregateError`
- l'une d'elles lancée par une `const` (`const failure = new Error('x'); throw failure;`) ou construite sous un alias `const` de sa classe (`const Failure = Error`)

Le message nomme l'étape qui écrit le refus dans la forme du projet : `generate error <context> <Refusal> for<Subject>` sous `"stack.refusals": "named"`, `generate error <context> <Concept> <refusal>` sous `factories` et `classes`.

Incorrect :

```ts
throw new Error('Invoice already issued');
```

Correct :

```ts
throw new InvoiceAlreadyIssued(this.id);
```

## Options

Aucune.

`rules."domain/no-generic-error"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line domain/no-generic-error -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- Une erreur construite sous un `let`, passée en paramètre ou rendue par une fonction avant d'être lancée n'est pas suivie.
- Une erreur générique renvoyée dans un `Result` (`err(new Error())`) ou rejetée (`Promise.reject`) n'est pas vue.

## Avec le checker de la CLI

Nouveau avec ce *plugin* : le *checker* de la CLI n'a pas d'équivalent, car la forme d'une classe demande un arbre syntaxique.
