import { beforeEach, describe, expect, it } from '{{tests.module}}';
import { relationTupleStoreContract } from '@ddd-ts-kit/auth/testing';
import { createTupleStore } from '{{alias.platform}}/auth/relationships/create-tuple-store{{alias.ext}}';

relationTupleStoreContract(
  { describe, it, expect, beforeEach },
  { name: 'The relation tuple store of the platform', create: createTupleStore },
);
