import { injected } from '@ddd-ts-kit/kernel/declarations';
import { OutcomeRegister } from '@/contexts/analytics/application/ports/outcome-register.port';
import { OutcomesProjection } from '@/contexts/analytics/application/projections/outcomes.projection';

export * from '@/contexts/analytics/application/projections/outcomes.projection';

injected(OutcomesProjection, [OutcomeRegister]);
