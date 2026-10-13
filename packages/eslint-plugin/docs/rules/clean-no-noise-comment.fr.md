[English](clean-no-noise-comment.md) · **Français**
<!-- translation-of: clean-no-noise-comment.md sha256:30b26c944ce7de38 -->

# ddd-ts-kit/clean-no-noise-comment

Identifiant d'architecture : `clean/no-noise-comment`. Sévérité par défaut : `warn` dans `recommended`, `error` dans `strict`.

S'applique à : chaque fichier passé au lint.

## Pourquoi

Un commentaire se garde pour ce que le code ne peut pas dire : pourquoi, une conséquence, une référence extérieure. Tout le reste est une seconde copie du code, que personne n'entretient.

## Signalé

- une bannière (`// ----- helpers -----`)
- une étiquette après une accolade fermante (`} // end if`)
- un auteur, une date ou un journal des modifications
- `@param name` ou `@returns` sans description
- un `TODO` ou un `FIXME` sans responsable (`TODO(owner)`) ni référence (`#123`, `ABC-12`, une URL)
- un commentaire ou une description JSDoc qui ne fait que répéter le nom déclaré juste en dessous

Incorrect :

```ts
/** The invoice repository. */
export class InvoiceRepository {}

// TODO corriger ça
```

Correct :

```ts
/** Charge aussi par numéro : le support cherche les factures par ce que lit le client. */
export class InvoiceRepository {}

// TODO(billing#142): nouvelle tentative avec un délai croissant
```

## Détails

« Répète le nom » compare les mots avec une petite flexion de l'anglais (`Issues the invoice` dit `issueInvoice`), en ignorant les mots de remplissage.

## Options

Aucune.

`rules."clean/no-noise-comment"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line clean/no-noise-comment -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- Des heuristiques sur la formulation : une description courte faite des mots du nom et de mots de remplissage est signalée même si l'auteur la trouvait utile.
- Seul le commentaire placé juste au-dessus d'une déclaration est comparé à un nom.

## Avec le checker de la CLI

`ddd-ts-kit check` approche cette règle sur le texte du fichier et reste le garde-fou rapide pendant l'écriture. Cette règle fait autorité.
