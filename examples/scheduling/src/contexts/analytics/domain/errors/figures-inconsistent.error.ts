import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { AnalyticsCodes } from '@/contexts/analytics/domain/errors/codes';

export class FiguresInconsistent extends DomainRefusal {
  readonly code = AnalyticsCodes.FiguresInconsistent;

  static forRule(rule: string) {
    return FiguresInconsistent.refusal(`The figures of a line of occupancy ${rule}.`, { rule });
  }
}
