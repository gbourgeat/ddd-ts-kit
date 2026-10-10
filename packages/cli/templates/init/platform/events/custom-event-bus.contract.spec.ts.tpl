import { beforeEach, describe, expect, it } from '{{tests.module}}';
import { eventBusContract } from '@ddd-ts-kit/testing/contracts';
import { CustomEventBus } from '{{alias.platform}}/events/custom-event-bus.js';

eventBusContract(
  { describe, it, expect, beforeEach },
  { name: 'The custom event bus', createBus: () => ({ bus: new CustomEventBus() }) },
);
