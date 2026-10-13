[English](clean-no-hash-private.md) · **Français**
<!-- translation-of: clean-no-hash-private.md sha256:8626d803eccfc564 -->

# ddd-ts-kit/clean-no-hash-private

Identifiant d'architecture : `clean/no-hash-private`. Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`. Corrigeable avec `--fix`.

S'applique à : chaque fichier passé au lint.

## Pourquoi

Il y a une seule façon de cacher un membre : le mot-clé `private`. Il se lit de la même façon sur un champ, une méthode, un accesseur et un paramètre de constructeur, le compilateur le vérifie, et les règles de ce *plugin* et le checker de la CLI le lisent. `#name` est une seconde graphie de la même intention, avec un comportement à l'exécution différent sur lequel rien ne s'appuie dans un modèle du domaine.

## Signalé

- un champ, une méthode, un accesseur ou un membre statique déclaré `#name`

Incorrect :

```ts
class Invoice {
  #total = 0;

  add(amount: number): void {
    this.#total += amount;
  }
}
```

Correct :

```ts
class Invoice {
  private total = 0;

  add(amount: number): void {
    this.total += amount;
  }
}
```

## Détails

**La correction.** `--fix` réécrit les déclarations de `#name` (un accesseur get et son accesseur set ensemble) et chacun de ses usages en `private name`, avec `private` placé avant `static`, `readonly`, `async`, `get` et `set`, après les décorateurs. Elle n'est appliquée que si elle ne peut pas changer le sens du code :

- la classe n'a aucun autre membre, ni aucune propriété de paramètre de constructeur, appelé `name` ;
- aucune autre classe du fichier ne déclare le même `#name` ;
- le fichier n'a pas de vérification de marque `#name in value` ;
- chaque usage est `this.#name` ou `<identifier>.#name` à l'intérieur de la classe.

Sinon, le membre est signalé sans correction. Deux noms différents dans une même classe sont réécrits en deux passes de la même exécution de `--fix`.

## Options

Aucune.

`rules."clean/no-hash-private"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line clean/no-hash-private -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- `private` est effacé à la compilation : du code qui comptait sur le fait que `#name` soit inaccessible à l'exécution (une vérification de marque, un appelant hostile) doit être réécrit à la main, et c'est pourquoi ces cas ne sont pas corrigés.
- Une sous-classe qui déclare un membre portant le nom libéré par la correction provoque alors une erreur de compilation ; renommez l'un des deux.

## Avec le checker de la CLI

`ddd-ts-kit check` signale le même identifiant à partir du texte du fichier. Cette règle fait autorité, et elle est la seule à corriger.
