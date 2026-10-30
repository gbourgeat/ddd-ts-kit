import { verifyTrail } from '@ddd-ts-kit/audit';
import { createAuditTrail } from '{{alias.platform}}/audit/create-audit-trail{{alias.ext}}';
import { loadConfig } from '{{alias.platform}}/config/load-config{{alias.ext}}';
import { openPersistence } from '{{alias.platform}}/database/open-persistence{{alias.ext}}';

// The verification of the audit trail, from the command line, as the job `audit.verify` runs it
// every night:
//   npm run audit:verify
// Every chain, from its last archive to its head: an entry changed, removed, reordered or cut from
// the end of its chain is a break, reported with its chain and its sequence, and the exit code is 1.
// The entries left in the database are linked to the anchor the last archive row keeps; the archived
// files are proven by `verifyArchive` of @ddd-ts-kit/audit (docs/concepts/audit-trail.md of ddd-ts-kit).
const persistence = {{persistence.await}}openPersistence(loadConfig(process.env));

try {
  const verification = await verifyTrail(createAuditTrail(persistence));

  console.log(JSON.stringify(verification, null, 2));
  process.exitCode = verification.valid ? 0 : 1;
} finally {
  await persistence.close();
}
