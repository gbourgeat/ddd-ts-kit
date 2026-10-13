[English](clean-no-commented-out-code.md) · **Français**
<!-- translation-of: clean-no-commented-out-code.md sha256:054e74cca15da79d -->

# ddd-ts-kit/clean-no-commented-out-code

Identifiant d'architecture : `clean/no-commented-out-code`. Sévérité par défaut : `error` dans `recommended`, `error` dans `strict`.

S'applique à : chaque fichier passé au lint.

## Pourquoi

Du code en commentaire ne s'exécute pas, n'est pas vérifié par le typage et n'est jamais supprimé. Le gestionnaire de versions garde l'ancienne version.

## Signalé

- un paragraphe `//` ou un bloc `/* */` dont le texte s'analyse comme des instructions, comme un corps de fonction ou comme des membres de classe, et contient une déclaration, une instruction de contrôle, un appel ou une affectation
- une ligne d'ouverture laissée seule (`if (x) {`, `items.forEach((item) => {`)

Incorrect :

```ts
// const total = lines.reduce(add, 0);
// if (invoice.isPaid()) {
//   return;
// }
```

Correct :

```ts
// Le fournisseur arrondit au demi supérieur (contrat 4.2), donc nous arrondissons avant de sommer.
```

## Détails

Le corps du commentaire est donné à l'analyseur configuré pour le fichier, si bien que la syntaxe TypeScript est comprise. La prose est filtrée avant et après l'analyse : une phrase de mots ordinaires, un identifiant isolé, une étiquette (`note: ...`), une expression de type, `name (unit)`, un `TODO`, une URL et les directives d'outils ne sont jamais du code. Les blocs JSDoc sont ignorés : leurs `@example` et leurs exemples entre clôtures sont de la documentation.

## Options

Aucune.

`rules."clean/no-commented-out-code"` à `off` dans `ddd-ts-kit.config.json` désactive la règle, et `// ddd-ts-kit-disable-next-line clean/no-commented-out-code -- <reason>` désactive une ligne, exactement comme pour `ddd-ts-kit check`.

## Limites

- Un appel sur une ligne comme `// validate(input);` est signalé même quand il se voulait une mention : citez-le entre accents graves dans une phrase.
- Du code écrit comme une phrase, ou sans aucune ponctuation de code (`return value`), n'est pas vu.

## Avec le checker de la CLI

`ddd-ts-kit check` approche cette règle sur le texte du fichier, avec la même exemption des blocs JSDoc, et reste le garde-fou rapide pendant l'écriture. Cette règle fait autorité.
