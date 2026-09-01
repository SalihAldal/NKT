import type { GameStage } from '@/domain/constants/game';
import { gameError } from '@/services/errors/app-error';

const TRANSITIONS: Record<GameStage, GameStage[]> = {
  category_selection: ['countdown', 'cancelled', 'aborted'],
  countdown: ['round_active', 'aborted', 'cancelled'],
  round_active: ['round_result', 'aborted', 'cancelled'],
  round_result: ['round_active', 'stage_transition', 'final_result', 'aborted', 'cancelled'],
  stage_transition: ['round_active', 'aborted', 'cancelled'],
  final_result: ['completed', 'aborted'],
  completed: [],
  aborted: [],
  cancelled: [],
};

export class GameStateMachine {
  private stage: GameStage;

  constructor(initial: GameStage = 'category_selection') {
    this.stage = initial;
  }

  get current(): GameStage {
    return this.stage;
  }

  transition(next: GameStage): GameStage {
    const allowed = TRANSITIONS[this.stage];
    if (!allowed.includes(next)) {
      throw gameError('INVALID_TRANSITION', `Geçersiz geçiş: ${this.stage} → ${next}`);
    }
    this.stage = next;
    return this.stage;
  }

  canTransition(next: GameStage): boolean {
    return TRANSITIONS[this.stage].includes(next);
  }
}
