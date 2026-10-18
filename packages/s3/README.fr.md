[English](README.md) · **Français**
<!-- translation-of: README.md sha256:648595bec5f485e4 -->

# @ddd-ts-kit/s3

Le `FileStorage` du noyau sur tout fournisseur du protocole S3 : AWS S3, MinIO, OVHcloud Object
Storage, Scaleway, Cloudflare R2, Garage. Le contenu d'un fichier part en flux vers le bucket par
parties, jamais entier en mémoire et jamais dans la base de données ; l'agrégat garde le
`StoredFile` que renvoie `put`. Rien dans `domain/` ou `application/` n'importe ce *package* : les
gestionnaires (handlers) dépendent du port `FileStorage`, et la plateforme lie cet adaptateur.

```
npm i @ddd-ts-kit/s3 @aws-sdk/client-s3 @aws-sdk/lib-storage @aws-sdk/s3-request-presigner
```

Les trois *packages* du SDK AWS v3 officiel sont des dépendances *peer* optionnelles, écrites pour
la version 3.1150.

![Les cas d'usage et FileStaging dépendent du port FileStorage du noyau ; S3FileStorage l'implémente, place chaque clé sous son préfixe et envoie ses commandes par un S3Client construit par s3ClientOf ; le client envoie et télécharge directement vers le bucket par des liens signés ; le bucket garde les fichiers promus sous leurs clés et les fichiers mis en attente sous staging/](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/s3-place-in-an-application.fr.svg)

Les cas d'usage parlent au port avec des clés comme `appointment-documents/2026/10/7f3c`,
générées par `TenantFileKeys`, le `FileKeys` du noyau : la zone, l'année, le mois, puis un
identifiant issu de l'`IdGenerator` (précédés de `tenants/<tenant>/` quand le travail en cours
désigne un tenant). L'adaptateur place son préfixe devant chaque clé
(`scheduling/appointment-documents/2026/10/7f3c` dans le bucket), et `FileStaging` place
`staging/` devant la clé d'un fichier qui attend sa validation
(`scheduling/staging/appointment-documents/2026/10/9a1b`). Les octets d'un fichier vont du client
au bucket, ou de l'API au bucket par parties, et la base de données ne garde que la référence.

## Racine de composition

<!-- checked sample -->
```ts
import type { FileStorage } from '@ddd-ts-kit/kernel';
import { S3FileStorage, s3ClientOf } from '@ddd-ts-kit/s3';

declare const config: {
  readonly storage: {
    readonly endpoint?: string;
    readonly region: string;
    readonly accessKeyId: string;
    readonly secretAccessKey: string;
    readonly bucket: string;
  };
};

const { endpoint, region, accessKeyId, secretAccessKey, bucket } = config.storage;

export const files: FileStorage = new S3FileStorage({
  client: s3ClientOf({
    ...(endpoint === undefined ? {} : { endpoint }), // omis pour AWS ; http://localhost:9000 pour MinIO
    region, // 'auto' pour R2
    accessKeyId,
    secretAccessKey,
  }),
  bucket, // créé par le code d'infrastructure, jamais par l'application
  prefix: 'scheduling/', // facultatif : plusieurs applications dans un seul bucket
});
```

`s3ClientOf` active l'adressage par chemin (path-style) quand un endpoint est donné (MinIO et la
plupart des serveurs auto-hébergés en ont besoin) et ne calcule d'empreinte (checksum) que
lorsqu'une opération en exige une : par défaut, le SDK envoie une empreinte avec chaque requête,
ce que refusent plusieurs fournisseurs qui ne sont pas AWS, et ce qui lierait un lien d'envoi
signé à un corps vide. Un client construit à la main fonctionne aussi.

Les options de `S3FileStorage` :

| Option | Par défaut | |
|---|---|---|
| `client` | requis | un `S3Client`, issu de `s3ClientOf` ou construit à la main |
| `bucket` | requis | il doit exister : l'adaptateur n'en crée jamais |
| `prefix` | aucun | une clé valide terminée par `/`, placée devant chaque clé ; le constructeur en refuse toute autre |
| `partSize` | 8 Mio | la taille de chaque partie d'un envoi, au moins 5 Mio : le maximum gardé en mémoire par envoi |
| `clock` | l'horloge du système | donne l'heure des `expiresAt` que renvoient les liens signés |

Un gestionnaire dépend du port, jamais du SDK :

```ts
// À éviter : le gestionnaire parle S3, garde tout le fichier en mémoire et nomme le bucket
const body = Buffer.concat(await Array.fromAsync(rows));
await s3.send(new PutObjectCommand({ Bucket: 'acme-files', Key: `exports/${id}.csv`, Body: body }));
```

<!-- checked sample -->
```ts
import { FileKeys, FileStorage, type StoredFile } from '@ddd-ts-kit/kernel';

// Écrire : le port du noyau ; la plateforme y lie S3FileStorage, un test InMemoryFileStorage.
export class ExportAppointments {
  constructor(
    private readonly files: FileStorage,
    private readonly keys: FileKeys,
  ) {}

  async execute(csv: AsyncIterable<Uint8Array>): Promise<{ readonly file: StoredFile; readonly link: string }> {
    const key = this.keys.next('appointment-exports');

    // Part en flux vers le bucket par parties ; au-delà de 50 Mio, FILE_TOO_LARGE, et rien ne reste sous la clé.
    const file = await this.files.put(key, csv, { mediaType: 'text/csv', maxBytes: 50 * 1_048_576 });

    // Un GetObject présigné, calculé localement : aucune requête n'atteint le bucket.
    const { url } = await this.files.signedDownloadUrl(key, { expiresInSeconds: 300, fileName: 'appointments.csv' });

    return { file, link: url };
  }
}
```

## Ce qu'il fait

| Méthode du port | Sur le bucket |
|---|---|
| `put(key, stream, { mediaType, maxBytes })` | un envoi *multipart* en parties de `partSize` (8 Mio par défaut, une seule en mémoire à la fois), ou un seul `PutObject` quand le contenu tient dans une partie ; le contenu est compté et haché au passage, et refusé avec `FILE_TOO_LARGE` au-delà de `maxBytes`, ce qui abandonne l'envoi et laisse l'objet précédent |
| `get`, `stat` | `GetObject` en flux, `HeadObject` ; `undefined` quand l'objet n'existe pas, un rejet quand le service est injoignable |
| `delete` | `DeleteObject`, idempotent |
| `copy`, `move` | `CopyObject`, fait par le service (et `DeleteObject` pour un déplacement), jusqu'à 5 Gio par objet |
| `list(prefix)` | `ListObjectsV2`, page après page |
| `signedDownloadUrl` | un `GetObject` présigné, servi avec `Content-Disposition: attachment`, avec le nom du fichier quand il est donné |
| `signedUploadUrl` | un `PutObject` présigné dont la signature couvre le `content-type` : un autre type de média est refusé par le service |

L'empreinte (`sha256:<hex>`) est renvoyée par `put`, calculée pendant que le contenu passe ; le
bucket ne la garde pas, si bien que `stat` n'en renvoie aucune. Un fichier envoyé par un lien signé
est mesuré, vérifié et haché par `FileStaging.confirm` du noyau, qui le relit.

Une clé que le port refuse (`../escape`) est refusée avec `INVALID_FILE_KEY`, et un lien demandé
pour plus d'une heure avec `INVALID_FILE_URL_EXPIRY`, avant toute requête. La signature ne
demande pas de requête non plus : un lien signé est calculé à partir des identifiants d'accès, et
seul le fournisseur le vérifie, quand le client l'utilise.

![Un envoi par lien signé : le client demande un lien, FileStaging.uploadUrl fait signer un PUT localement par S3FileStorage et garde l'autorisation d'envoi sur l'agrégat, le client envoie le fichier directement au bucket, qui vérifie la clé, la méthode, le content-type et l'expiration mais ne peut pas plafonner la taille ; puis le client confirme, et FileStaging.confirm relit l'objet mis en attente pour vérifier sa taille contre le plafond, son type de média, son empreinte et l'analyse](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/s3-signed-upload.fr.svg)

Le client envoie le fichier exactement comme le dit le lien, avec les en-têtes qu'il a reçus :

<!-- checked sample -->
```ts
import type { SignedUpload } from '@ddd-ts-kit/kernel';

// Dans le client : la signature couvre le content-type, les en-têtes sont donc envoyés tels quels.
export async function sendFile(link: SignedUpload, file: Blob): Promise<void> {
  const response = await fetch(link.url, { method: link.method, headers: link.headers, body: file });

  if (!response.ok) {
    throw new Error(`The storage refused the upload: ${response.status}`); // 403 une fois expiré, ou pour un autre type
  }
}
```

## Limites

- Un lien d'envoi signé ne peut pas plafonner la taille de ce qui est envoyé (seule une politique
  de POST présigné le peut) : son `maxBytes` n'est pas appliqué par le service, et
  `FileStaging.confirm` mesure le fichier contre le plafond de l'autorisation d'envoi que le
  serveur a gardée, et le supprime au-delà.
- La copie et le déplacement passent par `CopyObject`, limité à 5 Gio par objet par le protocole.
- Un envoi compte au plus 10 000 parties : avec des parties de 8 Mio, un fichier d'environ 78 Gio.
  Augmentez `partSize` pour des fichiers plus gros.
- Les règles de cycle de vie, le versionnement, le verrouillage d'objet (object lock) et le
  chiffrement du bucket sont des réglages du bucket, faits par le code d'infrastructure du
  déploiement, pas par cet adaptateur.

## Tests

Le contrat du port est tenu contre un vrai serveur : `fileStorageContract` de
`@ddd-ts-kit/testing/contracts` (réexporté par `@ddd-ts-kit/s3/testing`) s'exécute sur MinIO dans
le *job* d'intégration du *pipeline*, avec la variable `DDD_TS_KIT_TEST_S3_ENDPOINT` définie ;
sans elle, les *specs* qui ont besoin d'un serveur sont ignorées. Le projet MinIO amont a cessé
de publier des images en 2025 : le *pipeline* exécute `pgsty/minio`, construit à partir des
mêmes sources, épinglé par *digest* (`pipeline/github/scripts/start-minio.sh`).

```
docker run -d --name minio -p 127.0.0.1:9000:9000 -e MINIO_ROOT_USER=ddd-ts-kit -e MINIO_ROOT_PASSWORD=ddd-ts-kit-secret pgsty/minio:RELEASE.2026-08-04T00-00-00Z server /data
DDD_TS_KIT_TEST_S3_ENDPOINT=http://localhost:9000 npx vitest run packages/s3
```

Les mêmes *specs* s'exécutent sur un autre serveur du protocole : `DDD_TS_KIT_TEST_S3_REGION`
(`us-east-1` par défaut), `DDD_TS_KIT_TEST_S3_ACCESS_KEY` et `DDD_TS_KIT_TEST_S3_SECRET_KEY`
nomment sa région et sa clé, et le bucket `ddd-ts-kit-test` est créé quand la clé peut en créer
un. Exécuté une fois à la main sur Garage v2.1.0 (2026-10-18), région `garage` : les 34 tests
sont passés. Les autres fournisseurs de
[docs/tools/file-storage.md](../../docs/tools/file-storage.fr.md) ne sont pas vérifiés.

Un projet tient sa propre liaison à la même suite, sur le MinIO de sa *stack* compose : chaque
test écrit sous un préfixe à lui, si bien que les tests partagent un seul bucket sans voir les
fichiers des autres.

<!-- checked sample -->
```ts
import { randomBytes } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { S3FileStorage, s3ClientOf } from '@ddd-ts-kit/s3';
import { fileStorageContract } from '@ddd-ts-kit/s3/testing';

const endpoint = process.env['S3_TEST_ENDPOINT'] ?? '';

// Ignoré sans serveur ; le bucket est créé au préalable, comme dans un déploiement.
fileStorageContract(
  { describe: describe.runIf(endpoint !== ''), it, expect, beforeEach },
  {
    name: 'S3FileStorage on MinIO',
    createStorage: () =>
      new S3FileStorage({
        client: s3ClientOf({ endpoint, region: 'us-east-1', accessKeyId: 'minio', secretAccessKey: 'minio-secret' }),
        bucket: 'acme-files-test',
        prefix: `run-${randomBytes(6).toString('hex')}/`,
      }),
    // Les liens d'un vrai serveur expirent en temps réel.
    elapse: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  },
);
```

## Un autre fournisseur

Google Cloud Storage et Azure Blob Storage parlent leurs propres protocoles. Un connecteur pour
l'un d'eux est une classe qui étend `FileStorage` du noyau et passe `fileStorageContract` contre
le vrai service ou son émulateur (fake-gcs-server, Azurite) : voir
[Connecteurs de stockage de fichiers](../../docs/tools/file-storage.fr.md).
