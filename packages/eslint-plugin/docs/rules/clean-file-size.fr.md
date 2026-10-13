[English](clean-file-size.md) · **Français**
<!-- translation-of: clean-file-size.md sha256:8081d7f2709afd25 -->

# ddd-ts-kit/clean-file-size

Identifiant d'architecture : `clean/file-size`. Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : chaque fichier passé au lint, tests compris.

## Pourquoi

Un fichier qu'on ne lit pas d'une traite porte plus d'une responsabilité : deux classes qui ont grandi ensemble, une fonction et les auxiliaires d'une autre, une *spec* qui teste trois comportements. La limite est un signal pour découper par responsabilité, pas un nombre à atteindre.

## Signalé

- un fichier de plus de 350 lignes : chaque ligne physique compte, commentaires et lignes vides compris ; un saut de ligne final n'en ajoute aucune

Incorrect :

```ts
// invoice.aggregate.spec.ts : 600 lignes, émission, paiement et annulation dans un seul fichier
```

Correct :

```ts
// invoice-issuing.spec.ts, invoice-payment.spec.ts, invoice-voiding.spec.ts : un comportement chacun
```

## Détails

Le constat est signalé une fois, à la ligne 351. Les fichiers de déclaration (`*.d.ts`) et tout fichier sous un répertoire nommé `generated` sont exemptés : personne ne les lit d'une traite, et personne ne les écrit.

## Options

Aucune : la limite est de 350 lignes et n'est pas configurable.

`rules."clean/file-size"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line clean/file-size -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- La règle dit qu'un fichier est trop long, pas où le couper : découpez par responsabilité, et nommez chaque fichier d'après ce qu'il contient (`clean/one-export-per-file`).

## Avec le checker de la CLI

`ddd-ts-kit check` signale le même identifiant avec le même décompte. Les deux outils sont d'accord.
