import { _decorator, Component, Label } from 'cc';
import { EVENT } from '../core/GameConst';
import { EventCenter } from '../core/EventCenter';
import { LevelClearResult } from '../core/GameTypes';
import { GameManager } from '../manager/GameManager';
import { UIManager } from '../manager/UIManager';

const { ccclass, property } = _decorator;

@ccclass('ResultView')
export class ResultView extends Component {
  @property(Label)
  titleLabel: Label | null = null;

  @property(Label)
  starsLabel: Label | null = null;

  @property(Label)
  timeLabel: Label | null = null;

  @property(Label)
  rewardLabel: Label | null = null;

  private result?: LevelClearResult;

  onEnable(): void {
    EventCenter.on<LevelClearResult>(EVENT.LEVEL_COMPLETED, this.onLevelCompleted);
  }

  onDisable(): void {
    EventCenter.off<LevelClearResult>(EVENT.LEVEL_COMPLETED, this.onLevelCompleted);
  }

  async onNextLevel(): Promise<void> {
    await GameManager.instance.startLevel(this.result?.nextLevel ?? 1);
    UIManager.show('Game');
  }

  onBackHome(): void {
    UIManager.show('Home');
  }

  private onLevelCompleted = (result: LevelClearResult): void => {
    this.result = result;
    if (this.titleLabel) {
      this.titleLabel.string = 'Level Clear';
    }
    if (this.starsLabel) {
      this.starsLabel.string = '★ '.repeat(result.stars).trim();
    }
    if (this.timeLabel) {
      const minute = Math.floor(result.usedSeconds / 60).toString().padStart(2, '0');
      const second = (result.usedSeconds % 60).toString().padStart(2, '0');
      this.timeLabel.string = `用时：${minute}:${second}`;
    }
    if (this.rewardLabel) {
      this.rewardLabel.string = `奖励：金币 +${result.coin}`;
    }
  };
}
