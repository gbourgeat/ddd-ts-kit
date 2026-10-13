[English](file-storage.md) · **Français**
<!-- translation-of: file-storage.md sha256:5dca8f258a3e33ca -->

# Connecteurs de stockage de fichiers

**Résumé.** Les fichiers vivent derrière le port `FileStorage` du kernel. Le kit livre trois
connecteurs tenus à une même suite de contrat (`fileStorageContract` de
`@ddd-ts-kit/testing/contracts`) : la mémoire du processus pour les tests, un répertoire local pour
le développement, et un bucket compatible S3 (`@ddd-ts-kit/s3`, sur le SDK AWS v3 officiel) pour
un déploiement, qui couvre AWS S3, MinIO, OVHcloud, Scaleway, Cloudflare R2 et Garage. Google Cloud
Storage et Azure Blob Storage s'atteignent en écrivant un adaptateur qui passe la même suite.
Choisissez le connecteur S3 pour tout ce qui est déployé ; gardez le répertoire pour la machine
d'un développeur.

## Les connecteurs

Les cas d'usage connaissent un seul port, `FileStorage` ; la plateforme lie un connecteur au
démarrage, et une seule suite de contrat tient chaque connecteur au même comportement. Changer de
connecteur ne change aucune ligne de la base non plus : l'agrégat garde un `StoredFile` (clé, taille, type de
média, empreinte), qui ne nomme ni fournisseur, ni bucket, ni URL.

![Les cas d'usage et FileStaging dépendent du port FileStorage ; InMemoryFileStorage, LocalFileStorage, S3FileStorage et un connecteur à vous l'implémentent ; les deux premiers sont des stockages servis dont l'application répond aux liens par signedFileRoutes ; S3FileStorage atteint AWS S3, MinIO, OVHcloud, Scaleway, Cloudflare R2 et Garage ; fileStorageContract s'exécute sur chacun d'eux](../assets/diagrams/file-storage-connectors-one-port.fr.svg)

| | `InMemoryFileStorage` | `LocalFileStorage` | `S3FileStorage` (`@ddd-ts-kit/s3`) |
|---|---|---|---|
| Pour | les tests, les outils | le développement, une machine | tout déploiement |
| Où est le contenu | une *map* dans le processus | un répertoire, métadonnées dans `.metadata/` | un bucket, sous un préfixe facultatif |
| Flux | en entrée, puis gardé en mémoire | en entrée et en sortie, une écriture renommée à sa place | envoi *multipart* en parties de 8 Mio, une seule en mémoire ; un flux en sortie |
| Liens signés | jetons auxquels répond `signedFileRoutes` | jetons auxquels répond `signedFileRoutes` | présignés par le service |
| Plusieurs instances | non | non | oui |
| Empreinte gardée | oui | oui | répondue par `put`, non gardée |
| Copie, déplacement | en mémoire | système de fichiers | `CopyObject`, 5 Gio par objet |
| Lié par `init` | dans les tests et les outils, quel que soit `stack.storage` | `stack.storage: local` | `stack.storage: s3`, MinIO dans la stack compose |

La ligne « Liens signés » est la différence qui compte le plus une fois déployé. La mémoire et le
répertoire sont des **stockages servis** (`ServedFileStorage`) : un lien qu'ils signent pointe vers
l'application, qui doit y répondre, si bien que chaque octet passe par l'API. Un bucket répond à
ses propres liens présignés : l'API ne fait que signer, sans aucune requête au bucket, et le client
télécharge ou envoie directement vers le stockage.

![À gauche, un stockage servi : le client demande un lien à un cas d'usage, qui fait signer un jeton par LocalFileStorage, reçoit /files?token=..., et le GET de ce lien atteint signedFileRoutes, qui lit le fichier dans LocalFileStorage. À droite, un stockage objet : S3FileStorage présigne l'URL sans requête, et le client télécharge directement depuis le bucket, qui vérifie la signature et l'expiration](../assets/diagrams/file-storage-connectors-signed-links.fr.svg)

`init` écrit les fichiers de la plateforme pour la *stack* qu'on lui a donnée ; côte à côte, les
deux choix et les routes qui répondent aux liens d'un stockage servi :

<!-- checked sample -->
```ts
import { signedFileRoutes, type Route } from '@ddd-ts-kit/http';
import { LocalFileStorage, ServedFileStorage, type FileStorage } from '@ddd-ts-kit/kernel';
import { S3FileStorage, s3ClientOf, type S3Settings } from '@ddd-ts-kit/s3';

// platform/files/open-files.ts avec stack.storage: local (FILES_DIRECTORY, FILES_PUBLIC_URL, FILES_SIGNING_SECRET)
export function openDirectory(config: {
  readonly directory: string;
  readonly publicUrl: string;
  readonly signingSecret?: string;
}): FileStorage {
  const { directory, publicUrl, signingSecret } = config;

  // sans secret, un secret est tiré à chaque démarrage, et les liens meurent avec le processus
  return new LocalFileStorage({
    directory,
    baseUrl: publicUrl,
    ...(signingSecret === undefined ? {} : { secret: signingSecret }),
  });
}

// platform/files/open-files.ts avec stack.storage: s3 (les variables S3_*)
export function openBucket(config: S3Settings & { readonly bucket: string }): FileStorage {
  const { bucket, ...settings } = config;

  return new S3FileStorage({ client: s3ClientOf(settings), bucket });
}

// platform/files/file-routes.ts : GET et PUT /files?token= pour un stockage servi, rien pour un bucket
export function fileRoutes(storage: FileStorage): readonly Route[] {
  return storage instanceof ServedFileStorage ? signedFileRoutes(storage) : [];
}
```

## Fournisseurs du protocole S3

| Fournisseur | Endpoint | Remarques |
|---|---|---|
| AWS S3 | aucun | la référence ; région du bucket |
| MinIO | `http://localhost:9000` en développement | adressage par chemin (path-style) ; le projet amont a cessé de publier des images en 2025 : le *pipeline* du kit et sa stack compose exécutent `pgsty/minio`, construit à partir des mêmes sources, épinglé par *digest* |
| OVHcloud Object Storage | `https://s3.<region>.io.cloud.ovh.net` | hébergement européen |
| Scaleway Object Storage | `https://s3.<region>.scw.cloud` | hébergement européen |
| Cloudflare R2 | `https://<account>.r2.cloudflarestorage.com` | région `auto` ; pas de frais de sortie |
| Garage | le vôtre | auto-hébergé, faible empreinte |

`s3ClientOf(settings)` construit un client pour n'importe lequel d'entre eux : adressage par chemin
avec un endpoint, et des sommes de contrôle seulement quand une opération en exige une, puisque le
comportement par défaut des SDK récents (une somme de contrôle sur chaque requête) est refusé par
plusieurs fournisseurs qui ne sont pas AWS et lierait un lien d'envoi signé à un corps vide.

Passer d'un fournisseur à un autre change l'environnement, pas le code. La plateforme d'un projet
généré avec `--storage s3` lit cinq variables ; ce qui change, c'est l'endpoint et la région (le
bucket et sa clé d'accès sont créés par le code d'infrastructure de chacun) :

```ini
# AWS S3 : pas d'endpoint, la région du bucket
S3_REGION=eu-west-3

# MinIO de la stack compose, en développement
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1

# OVHcloud Object Storage, Gravelines
S3_ENDPOINT=https://s3.gra.io.cloud.ovh.net
S3_REGION=gra

# Scaleway Object Storage, Paris
S3_ENDPOINT=https://s3.fr-par.scw.cloud
S3_REGION=fr-par

# Cloudflare R2
S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com
S3_REGION=auto

# et, dans tous les cas
S3_BUCKET=acme-files
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
```

Ce que fait `put` du contenu en route vers un bucket : il est compté et haché au fil du flux,
envoyé en parties, et refusé au-delà de sa limite sans rien laisser derrière lui.

![Le flux FileSource passe par FileInspection, qui le compte et le hache, puis l'Upload de @aws-sdk/lib-storage l'envoie en parties de 8 Mio, une seule en mémoire à la fois, et le bucket assemble l'objet après la dernière partie ; put renvoie le StoredFile avec clé, taille, type de média et empreinte. Au-delà de maxBytes, FILE_TOO_LARGE : l'envoi est abandonné, aucune partie ne reste, et l'objet précédent reste](../assets/diagrams/file-storage-connectors-s3-put.fr.svg)

## Critères de choix

1. **Plus d'une instance, ou un conteneur qui est remplacé :** un stockage objet. Un répertoire
   est perdu avec sa machine et n'est pas partagé.
2. **Où les données peuvent vivre :** un fournisseur dans la région que nomment vos obligations ;
   le bucket, son chiffrement, son versionnement et son cycle de vie sont du code d'infrastructure,
   pas du code applicatif.
3. **Sortie de données :** des fichiers souvent téléchargés coûtent chez un fournisseur qui
   facture la sortie ; R2 ne la facture pas.
4. **Auto-hébergement :** MinIO ou Garage, chacun avec sa charge d'exploitation.

## Ce que le kit prend en charge et a vérifié

- La suite de contrat s'exécute sur `InMemoryFileStorage` et `LocalFileStorage` dans l'exécution
  unitaire, et sur `S3FileStorage` contre un vrai serveur MinIO dans le *job* d'intégration du
  *pipeline* (`pipeline/github/scripts/start-minio.sh`, un service du *job* GitLab) : aller-retour
  avec taille, type de média et empreinte, six mébioctets transmis en flux sur plusieurs parties,
  une écriture refusée au-delà de sa limite qui laisse l'objet précédent et aucune partie
  derrière elle, des clés qui pourraient sortir de leur place refusées, copie, déplacement,
  listage, des liens signés qui expirent, qui refusent une signature modifiée ou un autre type de
  média.
- `init --storage local|s3` câble la plateforme : `platform/files/` lie les ports, enregistre la
  purge horaire des fichiers mis en attente, monte les routes qui répondent aux liens d'un stockage
  servi et le lecteur d'envois ; `generate file-upload` écrit le premier envoi.
- Non vérifié : les autres fournisseurs du tableau, qui parlent le même protocole ; un fournisseur
  dont l'envoi présigné ignore le `content-type` signé.

## Un autre fournisseur : Google Cloud Storage, Azure Blob Storage

Un connecteur est une classe de la plateforme (ou un *package* à vous) qui étend `FileStorage` et
passe la suite de contrat contre le vrai service ou son émulateur :

```ts
// platform/files/gcs-file-storage.ts : put, écrit comme S3FileStorage l'écrit
export class GcsFileStorage extends FileStorage {
  constructor(private readonly bucket: Bucket) {
    super();
  }

  async put(key: string, content: FileSource, options: PutOptions): Promise<StoredFile> {
    const mediaType = mediaTypeOf(options.mediaType);
    // compte et hache le contenu au passage, et échoue avec FILE_TOO_LARGE au-delà de maxBytes
    const inspection = new FileInspection(options.maxBytes === undefined ? {} : { maxBytes: options.maxBytes });
    const target = this.bucket.file(assertFileKey(key)).createWriteStream({ contentType: mediaType, resumable: true });

    await pipeline(content, inspection, target);

    return { key, size: inspection.size, mediaType, checksum: inspection.checksum };
  }

  // get, stat, delete, copy, move, list, signedDownloadUrl (URL signée v4), signedUploadUrl (v4, content-type signé)
}
```

`FileInspection`, `assertFileKey`, `assertExpiry`, `mediaTypeOf` et `contentDisposition` sont
exportés par `@ddd-ts-kit/kernel` pour les connecteurs : les règles que partagent tous les
connecteurs sont écrites une seule fois. Ensuite, la suite de contrat s'exécute contre l'émulateur,
dans les *specs* d'intégration :

<!-- checked sample -->
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import type { FileStorage } from '@ddd-ts-kit/kernel';
import { fileStorageContract } from '@ddd-ts-kit/testing/contracts';

// platform/files/gcs-file-storage.ts, le connecteur ci-dessus
declare const GcsFileStorage: new (bucketName: string) => FileStorage;
// un bucket de fake-gcs-server (Azurite pour Azure), neuf pour chaque test
declare function freshBucket(): string;

// test/integration/gcs-file-storage.contract.spec.ts
fileStorageContract(
  { describe, it, expect, beforeEach },
  {
    name: 'GcsFileStorage',
    createStorage: () => new GcsFileStorage(freshBucket()),
    // les liens d'un vrai service expirent selon sa propre horloge : la suite attend réellement
    elapse: (ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  },
);
```

Un connecteur dont les liens pointent vers l'application (un stockage servi) passe aussi
`follow: followServed(storage)`, pour que la suite suive ses liens par `openSigned` et
`acceptSigned` au lieu de `fetch` ; le kit exécute ainsi ses connecteurs mémoire et répertoire,
avec une `FixedClock` avancée par `elapse`.

Ce à quoi la suite tient un connecteur : une écriture refusée (`FILE_TOO_LARGE`) ne laisse rien de
nouveau et garde le contenu précédent, donc écrivez dans un objet temporaire ou abandonnez
l'envoi ; un fichier absent répond `undefined` à `get` et `stat`, et `FILE_NOT_FOUND` à `copy` et
`move` ; une clé invalide est refusée avant toute requête (`assertFileKey`) ; les liens durent au
plus une heure (`assertExpiry`) ; un lien d'envoi est lié à son type de média ; un lien de
téléchargement est une pièce jointe, nommée ou non. Azure signe avec une SAS dont le
`content-type` ne peut pas être lié : vérifiez le type à `FileStaging.confirm`, par lequel passe de
toute façon chaque envoi direct.

## Limites, et quand ne pas l'utiliser

- Aucun connecteur ne fait d'une écriture une partie d'une transaction de base de données :
  `FileStaging` ordonne le travail, la purge nettoie.
- Le répertoire local et le connecteur mémoire répondent à leurs liens par l'application : avec
  Express, les routes sont montées avant `express.json()` ; derrière NestJS, son propre analyseur
  de corps lit d'abord un fichier JSON envoyé par un lien.
- Les fichiers qui ne doivent pas être supprimés pendant une période (conservation légale) ont
  besoin du verrouillage d'objet (object lock) sur le bucket, réglé par le code d'infrastructure.
- La diffusion de contenu vers de nombreux lecteurs (images d'un site public) revient à un CDN
  devant le bucket, pas aux liens signés de l'application.

## Recommandation selon la situation

| Situation | Choix |
|---|---|
| Un nouveau projet | `init` (répertoire local), puis `init --force --storage s3` avant le premier déploiement |
| Déployé sur AWS | `S3FileStorage`, sans endpoint |
| Hébergement européen exigé | OVHcloud ou Scaleway par `S3FileStorage` |
| Beaucoup de téléchargements | Cloudflare R2 par `S3FileStorage` |
| Auto-hébergé | MinIO (`pgsty/minio`) ou Garage par `S3FileStorage` |
| Google Cloud ou Azure seulement | un adaptateur à vous tenu à `fileStorageContract` |

## Sources

- SDK AWS pour JavaScript v3, `@aws-sdk/client-s3`, `@aws-sdk/lib-storage`,
  `@aws-sdk/s3-request-presigner` : 3.1150.0, vérifié avec `npm view` le 2026-10-12.
- Serveur MinIO, image `pgsty/minio:RELEASE.2026-08-04T00-00-00Z`
  (`sha256:b6bfe7239bfc83fb90d31612d9704d86039dd714f7904b3f1ad68f211e602372`) ; `minio/minio`
  répondait « denied » sur Docker Hub et aucune étiquette sur Quay le 2026-10-12.
- busboy 1.6.0, l'analyseur *multipart* de `@ddd-ts-kit/http/uploads`.

## Voir aussi

- [Stockage de fichiers](../concepts/file-storage.fr.md) : le concept, l'ordre de cohérence, la
  sécurité.
- [Persistance](persistence.fr.md) : ce qui va, lui, dans la base de données.
- [`@ddd-ts-kit/s3`](../../packages/s3/README.fr.md).
