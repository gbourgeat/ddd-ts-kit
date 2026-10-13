[English](clean-stepdown.md) · **Français**
<!-- translation-of: clean-stepdown.md sha256:5d4e6c7784d2cd19 -->

# ddd-ts-kit/clean-stepdown

Identifiant d'architecture : `clean/stepdown`. Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : chaque fichier passé au lint.

## Pourquoi

Un fichier se lit comme un journal : l'intention en haut, les détails en dessous. Le lecteur qui ouvre une classe rencontre ce qu'elle fait avant la manière, et n'a jamais à remonter pour trouver l'auxiliaire qu'une fonction vient d'appeler.

## Signalé

- une méthode privée, `#private` ou protégée déclarée avant une méthode publique
- une méthode statique publique déclarée après une méthode d'instance publique (les fabriques statiques viennent en premier)
- une méthode privée déclarée au-dessus de son premier appelant
- une fonction de premier niveau non exportée, ou une constante qui contient une fonction, déclarée au-dessus de son premier appelant

Incorrect :

```ts
function price(line: Line): number {
  return line.unit * line.quantity;
}

export function total(lines: Line[]): number {
  return lines.map(price).reduce(add, 0);
}
```

Correct :

```ts
export function total(lines: Line[]): number {
  return lines.map(price).reduce(add, 0);
}

function price(line: Line): number {
  return line.unit * line.quantity;
}
```

## Détails

Les appelants sont trouvés avec le gestionnaire de portées (scope manager) pour les fonctions, et par `this.x`, `this.#x` et `ClassName.x` pour les membres. La récursion et la récursion mutuelle n'ont pas de bon ordre et ne sont pas signalées. Une constante qui contient une fonction est laissée tranquille quand elle sert pendant le chargement du module, car la déplacer sous cet usage casserait à l'exécution.

## Options

Aucune.

`rules."clean/stepdown"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line clean/stepdown -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- Un membre appelé seulement par un autre receveur que `this` ou le nom de la classe (`other.#helper()`) n'a pas d'appelant connu et n'est pas signalé.
- Les constructeurs, les propriétés qui ne contiennent pas de fonction, les accesseurs sans corps et les signatures de surcharge sont neutres.
- Une fonction exportée n'est jamais priée de bouger : l'ordre entre fonctions exportées appartient à l'auteur.

## Avec le checker de la CLI

`ddd-ts-kit check` approche cette règle sur le texte du fichier et reste le garde-fou rapide pendant l'écriture. Cette règle fait autorité.
